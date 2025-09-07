import { redirect } from 'next/navigation';

// Redirect plain session path to the viewer (legacy expectation: /session/:specialtyId/:sessionId)
// Use a permissive prop signature to align with Next.js 15 PageProps (which may wrap params in a Promise type).
export default function SessionRedirectPage(props: any) {
  const id = props?.params?.id;
  const sessionId = props?.params?.sessionId;
  if (id && sessionId) redirect(`/session/${id}/${sessionId}/viewer`);
  redirect('/session');
}
