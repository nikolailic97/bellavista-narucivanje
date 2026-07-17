export default function PinPrijava({
  naslov,
  email,
  setEmail,
  pin,
  setPin,
  prijavaUToku,
  greska,
  onSubmit,
}) {
  return (
    <div className="max-w-sm mx-auto mt-16 sm:mt-24 px-4">
      <form
        onSubmit={onSubmit}
        className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg text-center space-y-5"
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900">{naslov}</h2>
          <p className="text-xs text-slate-500 mt-1">
            Unesi email i PIN kod za pristup
          </p>
        </div>

        <input
          type="email"
          placeholder="Email adresa"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-slate-200 rounded-xl p-3 text-base text-center focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          aria-label="Email adresa"
          autoFocus
        />

        <input
          type="password"
          inputMode="numeric"
          maxLength={10}
          placeholder="PIN kod"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full border border-slate-200 rounded-xl p-3.5 text-center text-xl tracking-[0.4em] font-bold focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          aria-label="PIN kod"
        />

        {greska && (
          <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg py-2 px-3">
            {greska}
          </p>
        )}

        <button
          type="submit"
          disabled={prijavaUToku}
          className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-bold p-3.5 rounded-xl text-sm hover:bg-slate-800 transition-all shadow-md"
        >
          {prijavaUToku ? "Prijava u toku..." : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}
