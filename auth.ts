import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    authorized: async ({ auth }) => {
      // Only allow users with @latitude.sh email
      if (auth?.user?.email?.endsWith("@latitude.sh")) {
        return true
      }
      return false
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
