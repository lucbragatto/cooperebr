import { redirect } from 'next/navigation';

// O login do cooperado é o /login (código por celular/e-mail). Esta rota antiga
// continua existindo porque o middleware e o interceptor 401 ainda apontam pra cá.
export default function PortalLoginPage() {
  redirect('/login');
}
