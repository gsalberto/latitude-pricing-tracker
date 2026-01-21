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
      const email = auth?.user?.email
      const allowedDomains = ["@latitude.sh", "@megaport.com"]

      if (email && allowedDomains.some(domain => email.endsWith(domain))) {
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
