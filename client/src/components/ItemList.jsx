export default function ItemList({ items, loading, error, selectedId, onSelect, onRemove }) {
  if (loading) return <p className="empty">Loading…</p>;
  if (error) return <p className="err standout" role="alert">{error}</p>;
  if (!items.length) return <p className="empty">Nothing saved yet.</p>;

  return (
    <ul className="items">
      {items.map(item => {
        const open = item.id === selectedId;
        const kind = item.sourceType === 'url' ? 'link' : 'note';
        const chunks = item.chunkCount === 1 ? '1 chunk' : `${item.chunkCount} chunks`;
        return (
          <li key={item.id} className={open ? 'item on' : 'item'}>
            <button type="button" className="item-hit" onClick={() => onSelect(item.id)}>
              <span className="title">{item.title}</span>
              <span className="meta" title={new Date(item.createdAt).toLocaleString()}>
                {kind} · {ago(item.createdAt)} · {chunks}
              </span>
              {!open && <span className="preview">{item.preview}</span>}
            </button>
            {open && (
              <div className="body">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                )}
                <p>{item.body}</p>
                <button type="button" className="quiet" onClick={() => onRemove(item.id)}>
                  Remove
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ago(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
