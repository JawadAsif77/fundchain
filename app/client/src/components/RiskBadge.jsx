export default function RiskBadge({ level, score }) {
  if (!level) {
    return (
      <span style={{
        padding: '4px 8px',
        background: '#ccc',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        Not analyzed
      </span>
    )
  }

  const colors = {
    LOW: '#22c55e',
    MEDIUM: '#facc15',
    HIGH: '#ef4444'
  }

  return (
    <span style={{
      padding: '4px 10px',
      background: colors[level],
      color: '#000',
      borderRadius: '6px',
      fontWeight: 'bold',
      fontSize: '12px'
    }}>
      {level} {score ? `(${Math.round(score * 100)}%)` : ''}
    </span>
  )
}
