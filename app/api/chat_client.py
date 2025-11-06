"""Rich-based CLI chat interface for WereCode API with OpenAI integration."""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Any
import httpx
from dotenv import load_dotenv
from openai import OpenAI
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table
from rich.prompt import Prompt
from rich.live import Live
from rich.spinner import Spinner
from rich import box

# Load environment variables
load_dotenv()


class SessionHistory:
    """Manages chat session history."""

    def __init__(self, session_file: Optional[Path] = None):
        self.session_file = session_file or Path(".werecode_session.json")
        self.messages: list[dict] = []
        self.load()

    def load(self):
        """Load session history from file."""
        if self.session_file.exists():
            try:
                with open(self.session_file, "r") as f:
                    data = json.load(f)
                    self.messages = data.get("messages", [])
            except Exception:
                self.messages = []

    def save(self):
        """Save session history to file."""
        try:
            with open(self.session_file, "w") as f:
                json.dump(
                    {
                        "messages": self.messages,
                        "last_updated": datetime.now().isoformat(),
                    },
                    f,
                    indent=2,
                )
        except Exception as e:
            print(f"Warning: Failed to save session: {e}")

    def add_message(self, role: str, content: str):
        """Add a message to history."""
        self.messages.append({"role": role, "content": content})
        self.save()

    def add_tool_call(self, tool_calls: list, tool_responses: list):
        """Add tool call and responses to history."""
        # Add assistant message with tool calls
        self.messages.append(
            {
                "role": "assistant",
                "content": None,
                "tool_calls": tool_calls,
            }
        )

        # Add tool responses
        for response in tool_responses:
            self.messages.append(response)

        self.save()

    def clear(self):
        """Clear session history."""
        self.messages = []
        if self.session_file.exists():
            self.session_file.unlink()

    def get_messages(self) -> list[dict]:
        """Get all messages."""
        return self.messages


class WereCodeChatClient:
    """Interactive chat client for WereCode API."""

    def __init__(
        self,
        api_base_url: str = "http://localhost:8000/api/v1",
        openai_api_key: Optional[str] = None,
    ):
        self.api_base_url = api_base_url
        self.console = Console()
        self.http_client = httpx.Client(timeout=30.0)

        # OpenAI client
        api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            self.console.print(
                "[red]Error: OPENAI_API_KEY not found in environment[/red]"
            )
            sys.exit(1)

        self.openai_client = OpenAI(api_key=api_key)

        # Load tools
        tools_file = Path(__file__).parent / "openai_tools.json"
        with open(tools_file, "r") as f:
            self.tools = json.load(f)["tools"]

        # Session history
        self.session = SessionHistory()

        # System prompt
        self.system_prompt = """You are WereCode Assistant, an AI helper for music analysis tasks.

You have access to tools for:
- Downloading audio from YouTube Music
- Converting audio formats
- Separating audio into stems (vocals, drums, bass, other)
- Analyzing music (tempo, key, chords, structure)
- Checking job status
- Querying analysis results

When users ask about music analysis tasks, use the appropriate tools to help them.
Always use job IDs to track long-running operations and check their status.
Be concise and helpful in your responses."""

    def call_api_tool(self, tool_name: str, arguments: dict) -> dict:
        """Call API endpoint corresponding to tool."""
        try:
            # Map tool names to API endpoints
            endpoint_map = {
                "download_audio": ("POST", "/download"),
                "convert_audio": ("POST", "/convert"),
                "separate_stems": ("POST", "/stems"),
                "analyze_audio": ("POST", "/analyze"),
                "get_job_status": ("GET", "/jobs/{job_id}"),
                "query_analysis": ("GET", "/analyze/query"),
                "list_analyzed_songs": ("GET", "/analyze/songs"),
            }

            if tool_name not in endpoint_map:
                return {"error": f"Unknown tool: {tool_name}"}

            method, path = endpoint_map[tool_name]

            # Format path with arguments if needed
            if "{job_id}" in path:
                path = path.format(job_id=arguments.get("job_id"))

            url = f"{self.api_base_url}{path}"

            # Make request
            if method == "GET":
                response = self.http_client.get(url, params=arguments)
            else:
                response = self.http_client.post(url, json=arguments)

            response.raise_for_status()
            return response.json()

        except Exception as e:
            return {"error": str(e)}

    def display_welcome(self):
        """Display welcome banner."""
        welcome = """
# 🎵 WereCode Assistant

Your AI-powered music analysis companion!

**Available commands:**
- Natural language requests for music analysis
- `/clear` - Clear session history
- `/history` - Show session history
- `/jobs` - List all jobs
- `/quit` or `/exit` - Exit the chat

**Example requests:**
- "Download audio from https://music.youtube.com/watch?v=abc123"
- "Convert song.m4a to WAV format"
- "Analyze the tempo and key of mysong.wav"
- "Separate the vocals from track.wav"
- "What's the status of job_abc123?"
        """
        self.console.print(Panel(Markdown(welcome), box=box.DOUBLE))

    def display_message(self, role: str, content: str):
        """Display a chat message."""
        if role == "user":
            self.console.print(f"\n[bold cyan]You:[/bold cyan] {content}")
        elif role == "assistant":
            self.console.print(Panel(Markdown(content), title="🎵 Assistant", border_style="green"))
        elif role == "system":
            self.console.print(f"[dim]{content}[/dim]")

    def display_tool_call(self, tool_name: str, arguments: dict, result: dict):
        """Display tool call and result."""
        # Create a table for the tool call
        table = Table(title=f"🔧 Tool: {tool_name}", box=box.ROUNDED)
        table.add_column("Parameter", style="cyan")
        table.add_column("Value", style="white")

        for key, value in arguments.items():
            table.add_row(key, str(value))

        self.console.print(table)

        # Display result
        if "error" in result:
            self.console.print(f"[red]Error: {result['error']}[/red]")
        else:
            self.console.print(Panel(
                Markdown(f"```json\n{json.dumps(result, indent=2)}\n```"),
                title="Result",
                border_style="blue"
            ))

    def handle_user_input(self, user_input: str) -> bool:
        """Handle user input and return True to continue, False to exit."""
        # Handle commands
        if user_input.startswith("/"):
            return self.handle_command(user_input)

        # Add user message to history
        self.session.add_message("user", user_input)

        # Prepare messages for OpenAI
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(self.session.get_messages())

        # Call OpenAI with tools
        with self.console.status("[bold green]Thinking...", spinner="dots"):
            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4-turbo-preview",
                    messages=messages,
                    tools=self.tools,
                    tool_choice="auto",
                )

                message = response.choices[0].message

                # Handle tool calls
                if message.tool_calls:
                    tool_call_results = []

                    for tool_call in message.tool_calls:
                        tool_name = tool_call.function.name
                        arguments = json.loads(tool_call.function.arguments)

                        # Display and execute tool call
                        result = self.call_api_tool(tool_name, arguments)
                        self.display_tool_call(tool_name, arguments, result)

                        # Add to results
                        tool_call_results.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(result),
                        })

                    # Add tool calls to history
                    self.session.add_tool_call(
                        [tc.model_dump() for tc in message.tool_calls],
                        tool_call_results
                    )

                    # Get follow-up response
                    messages.extend([
                        message.model_dump(),
                        *tool_call_results,
                    ])

                    followup = self.openai_client.chat.completions.create(
                        model="gpt-4-turbo-preview",
                        messages=messages,
                    )

                    assistant_message = followup.choices[0].message.content
                else:
                    assistant_message = message.content

                # Display and save assistant response
                self.display_message("assistant", assistant_message)
                self.session.add_message("assistant", assistant_message)

            except Exception as e:
                self.console.print(f"[red]Error: {e}[/red]")

        return True

    def handle_command(self, command: str) -> bool:
        """Handle special commands."""
        cmd = command.lower().strip()

        if cmd in ["/quit", "/exit"]:
            self.console.print("[yellow]Goodbye! 👋[/yellow]")
            return False

        elif cmd == "/clear":
            self.session.clear()
            self.console.print("[green]Session history cleared[/green]")

        elif cmd == "/history":
            if not self.session.messages:
                self.console.print("[yellow]No history yet[/yellow]")
            else:
                for msg in self.session.messages:
                    role = msg.get("role", "unknown")
                    content = msg.get("content", "")
                    if content:
                        self.display_message(role, content)

        elif cmd == "/jobs":
            try:
                response = self.http_client.get(f"{self.api_base_url}/jobs")
                jobs = response.json()
                self.console.print(Panel(
                    Markdown(f"```json\n{json.dumps(jobs, indent=2)}\n```"),
                    title="All Jobs",
                    border_style="blue"
                ))
            except Exception as e:
                self.console.print(f"[red]Error fetching jobs: {e}[/red]")

        else:
            self.console.print(f"[yellow]Unknown command: {command}[/yellow]")

        return True

    def run(self):
        """Run the interactive chat loop."""
        self.display_welcome()

        try:
            while True:
                user_input = Prompt.ask("\n[bold cyan]You[/bold cyan]")

                if not user_input.strip():
                    continue

                should_continue = self.handle_user_input(user_input)
                if not should_continue:
                    break

        except KeyboardInterrupt:
            self.console.print("\n[yellow]Interrupted. Goodbye! 👋[/yellow]")

        finally:
            self.http_client.close()


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="WereCode Chat Client")
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000/api/v1",
        help="Base URL for WereCode API",
    )
    parser.add_argument(
        "--api-key",
        help="OpenAI API key (or set OPENAI_API_KEY env var)",
    )

    args = parser.parse_args()

    client = WereCodeChatClient(
        api_base_url=args.api_url,
        openai_api_key=args.api_key,
    )

    client.run()


if __name__ == "__main__":
    main()
