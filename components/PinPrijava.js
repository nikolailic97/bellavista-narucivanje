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
        className="bg-ugalj p-8 rounded-3xl border border-ugalj-vis text-center space-y-5"
      >
        <div className="w-14 h-14 rounded-2xl bg-noc border border-ugalj-vis text-zlato flex items-center justify-center mx-auto">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        </div>

        <div>
          <h2 className="font-display text-xl text-krem">{naslov}</h2>
          <p className="text-xs text-krem-tih mt-1.5">
            Unesi email i PIN kod za pristup
          </p>
        </div>

        <input
          type="email"
          placeholder="Email adresa"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-noc border border-ugalj-vis rounded-xl p-3 text-base text-center text-krem placeholder:text-krem-tih/60 focus:outline-none focus:border-zlato transition-colors"
          aria-label="Email adresa"
          autoComplete="username"
          autoFocus
        />

        <input
          type="password"
          inputMode="numeric"
          maxLength={10}
          placeholder="PIN kod"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full bg-noc border border-ugalj-vis rounded-xl p-3.5 text-center font-num text-xl tracking-[0.4em] font-bold text-krem placeholder:font-body placeholder:text-base placeholder:tracking-normal placeholder:text-krem-tih/60 focus:outline-none focus:border-zlato transition-colors"
          aria-label="PIN kod"
          autoComplete="current-password"
        />

        {greska && (
          <p className="text-xs text-red-300 font-semibold bg-red-500/10 border border-red-500/25 rounded-lg py-2.5 px-3 leading-relaxed">
            {greska}
          </p>
        )}

        <button
          type="submit"
          disabled={prijavaUToku}
          className="w-full bg-zlato disabled:opacity-50 text-noc font-bold p-3.5 rounded-xl text-sm hover:bg-zlato-svetlo transition-colors"
        >
          {prijavaUToku ? "Prijava u toku..." : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}
