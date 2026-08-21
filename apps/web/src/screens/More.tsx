import { levelFromXp, list, pendingDebts } from '@habit/core';
import { useStore } from '../store/store.js';
import { ListRow } from '../components/ui.js';
import { Icon } from '../components/Icon.js';

/**
 * Pantalla "Mas" para movil: la barra inferior solo aguanta cinco destinos
 * sin volverse un menu diminuto, asi que el resto vive aqui. En escritorio
 * la barra lateral los muestra todos y esta pantalla no hace falta.
 */
export function More({ go }: { go: (v: string) => void }) {
  const { doc, config, sync } = useStore();
  const level = levelFromXp(doc.profile.xp);
  const debts = pendingDebts(doc).length;
  const goals = list(doc.goals).filter((g) => g.status === 'activo').length;

  return (
    <>
      <div className="page-head">
        <h1 className="title-lg">{doc.profile.name || 'Tu sistema'}</h1>
        <div className="sub">
          Nivel {level.level} · {level.title} · {doc.profile.xp} XP
        </div>
      </div>

      <div className="list">
        <ListRow
          lead={<Icon name="target" size={17} />}
          leadColor="var(--series-3)"
          title="Objetivos"
          subtitle={goals ? `${goals} activo(s)` : 'Sin objetivos definidos'}
          onClick={() => go('objetivos')}
        />
        <ListRow
          lead={<Icon name="scale" size={17} />}
          leadColor="var(--series-8)"
          title="Presion"
          subtitle={debts ? `${debts} deuda(s) pendientes` : 'Contrato, consecuencias y auditoria'}
          onClick={() => go('presion')}
        />
        <ListRow
          lead={<Icon name="idea" size={17} />}
          leadColor="var(--series-4)"
          title="Metodos"
          subtitle="Tecnicas y frases"
          onClick={() => go('metodos')}
        />
      </div>

      <div className="list">
        <ListRow
          lead={<Icon name="gear" size={17} />}
          leadColor="var(--text-3)"
          title="Ajustes"
          subtitle="Habitos, perfil, datos"
          onClick={() => go('ajustes')}
        />
        <ListRow
          lead={<Icon name="share" size={17} />}
          leadColor="var(--series-1)"
          title="Sincronizacion"
          subtitle={config ? `${config.email} · ${sync}` : 'Sin conectar'}
          onClick={() => go('ajustes')}
        />
      </div>
    </>
  );
}
