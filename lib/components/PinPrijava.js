export default function PinPrijava({
  naslov,
  pin,
  setPin,
  prijavaUToku,
  greska,
  onSubmit,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center space-y-4 max-w-sm mx-auto mt-12"
    >
      <h2 className="text-lg font-bold text-slate-900">{naslov}</h2>
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="Unesi 6-cifreni PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        className="w-full border border-slate-200 rounded-lg p-3 text-center text-lg tracking-widest focus:outline-none focus:border-slate-400"
        aria-label="PIN kod"
      />
      {greska && <p className="text-xs text-red-600 font-bold">{greska}</p>}
      <button
        type="submit"
        disabled={prijavaUToku}
        className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-bold p-3 rounded-xl text-sm"
      >
        {prijavaUToku ? "Prijava..." : "Login"}
      </button>
    </form>
  );
}
