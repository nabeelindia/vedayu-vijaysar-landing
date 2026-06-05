export default function PageHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a' }}>{title}</h1>
      {action}
    </div>
  );
}
