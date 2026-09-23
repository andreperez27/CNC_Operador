import Card from '../../../components/Card';
import ResultBox from '../../../components/ResultBox';
import CopyButton from '../../../components/CopyButton';
import { getGenerator } from '../registry/registry';

export default function GcodeOutput({ generatorId, params }) {
  if (!generatorId || !params) return null;

  const gen = getGenerator(generatorId);
  if (!gen) return null;

  const errors = gen.validate ? gen.validate(params) : null;
  if (errors) {
    return (
      <Card>
        <div style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: '.82rem' }}>
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      </Card>
    );
  }

  const solved = gen.solve(params);
  const codigo = gen.generate(params, solved);

  return (
    <Card>
      <ResultBox>{codigo}</ResultBox>
      <CopyButton getText={() => codigo} />
    </Card>
  );
}
