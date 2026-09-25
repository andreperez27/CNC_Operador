import Card from '../../components/Card';
import { useAuth } from './useAuth';

const MESSAGES = {
  'inactive': 'Seu acesso ao CNC Operador está expirado ou desativado. Entre em contato com o administrador.',
  'expired': 'Seu acesso ao CNC Operador está expirado ou desativado. Entre em contato com o administrador.',
  'no-profile': 'Seu acesso ao CNC Operador está expirado ou desativado. Entre em contato com o administrador.',
  'no-backend': 'Serviço de acesso indisponível. Entre em contato com o administrador.',
  'offline': 'Sem conexão com a internet e autorização expirada. Conecte-se para renovar o acesso ao CNC Operador.',
};

export default function BlockedPage() {
  const { reason, signOut } = useAuth();

  return (
    <div className="page">
      <Card title="Acesso bloqueado">
        <div className="info" role="alert">
          {MESSAGES[reason] || MESSAGES['inactive']}
        </div>
        <div className="btn-row">
          <button className="btn btn-s" type="button" onClick={signOut}>SAIR</button>
        </div>
      </Card>
    </div>
  );
}
