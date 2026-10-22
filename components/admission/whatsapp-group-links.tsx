export function WhatsappGroupLinks({ inviteUrl, onOpen, showUrl = true }: { inviteUrl: string; onOpen?: () => void; showUrl?: boolean }) {
  return <div className="grid min-w-0 gap-4">
    {showUrl ? <a href={inviteUrl} target="_blank" rel="noopener noreferrer" onClick={onOpen} className="break-all text-sm text-blue-600 underline hover:text-blue-800">{inviteUrl}</a> : null}
    <a href={inviteUrl} target="_blank" rel="noopener noreferrer" onClick={onOpen} className="inline-flex justify-center rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">Gabung Grup WhatsApp</a>
  </div>;
}
