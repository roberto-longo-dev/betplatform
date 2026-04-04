/** Shared request/response types between API and web clients. */

export interface User {
  id: string
  email: string
  createdAt: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
}

export type RegisterResponse = User

export type LoginResponse = TokenPair

export type RefreshResponse = TokenPair
