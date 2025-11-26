import { z } from 'zod'

// Example User Schema
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  age: z.number().int().positive().optional(),
  createdAt: z.date().default(() => new Date()),
})

export type User = z.infer<typeof userSchema>

// Example API Response Schema
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  message: z.string().optional(),
  error: z.string().optional(),
})

export type ApiResponse = z.infer<typeof apiResponseSchema>

// Example Form Schema
export const loginFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().default(false),
})

export type LoginForm = z.infer<typeof loginFormSchema>
