export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1A56DB] rounded-xl mb-3">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">DaanVeda CRM</h1>
          <p className="text-sm text-[#64748B] mt-1">NGO Sales Intelligence Platform</p>
        </div>
        {children}
      </div>
    </div>
  )
}
