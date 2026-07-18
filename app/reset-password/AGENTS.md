# Reset Password

## Purpose

Password reset flow. Users set a new password using a token from the forgot-password email.

## Ownership

- Reset password form component
- Token validation
- Password update via Better Auth

## Local Contracts

- Requires valid reset token in URL
- Uses Better Auth's password reset completion
- Redirects to login after successful reset
