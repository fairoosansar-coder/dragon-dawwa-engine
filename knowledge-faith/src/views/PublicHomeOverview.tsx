import { SeekerAuthCard } from '../components/SeekerAuthModal.tsx';

export function PublicHomeOverview() {
  return (
    <div
      data-public-home
      data-simple-login-screen
      style={{ backgroundColor: '#FAF7F0', color: '#18221D' }}
      className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col items-center justify-center bg-[#FAF7F0] px-4 py-8 text-[#18221D]"
    >
      <SeekerAuthCard inline />
    </div>
  );
}
