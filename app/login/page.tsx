import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full">
        <Link href="/" className="mx-auto mb-8 block w-fit text-xl font-black">Job<span className="text-indigo-600">Pilot</span></Link>
        <AuthForm />
      </div>
    </main>
  )
}
