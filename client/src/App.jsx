import { useEffect, useState } from 'react';
import { ask, ingest, listItems, removeItem } from './api.js';
import AskBox from './components/AskBox.jsx';
import ItemList from './components/ItemList.jsx';
import SaveBox from './components/SaveBox.jsx';

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [mode, setMode] = useState('note');
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listItems()
      .then(next => {
        if (!cancelled) setItems(next);
      })
      .catch(err => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function changeMode(next) {
    if (next === mode) return;
    setMode(next);
    setDraft('');
    setSaveError('');
  }

  function changeDraft(value) {
    setDraft(value);
    if (saveError) setSaveError('');
  }

  function changeQuestion(value) {
    setQuestion(value);
    if (askError) setAskError('');
  }

  async function onSave(event) {
    event.preventDefault();
    setSaveError('');
    const value = draft.trim();
    if (!value) {
      setSaveError(mode === 'url' ? 'Paste a link first.' : 'Write something first.');
      return;
    }
    setSaving(true);
    try {
      const item = await ingest(
        mode === 'url' ? { type: 'url', url: value } : { type: 'note', content: value },
      );
      setItems(await listItems());
      setSelectedId(item.id);
      setDraft('');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id) {
    if (!window.confirm('Remove this?')) return;
    setSaveError('');
    try {
      await removeItem(id);
      if (selectedId === id) setSelectedId(null);
      setItems(await listItems());
    } catch (err) {
      setSaveError(err.message);
    }
  }

  async function onAsk(event) {
    event.preventDefault();
    setAskError('');
    const q = question.trim();
    if (!q) {
      setAskError('Ask something first.');
      return;
    }
    setAsking(true);
    try {
      setResult(await ask(q));
    } catch (err) {
      setAskError(err.message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="app">
      <header className="mast">
        <h1>inbox</h1>
        <span>{loading ? '…' : `${items.length} saved`}</span>
      </header>
      <div className="workspace">
        <section className="side" aria-label="Saved">
          <SaveBox
            mode={mode}
            draft={draft}
            saving={saving}
            error={saveError}
            onMode={changeMode}
            onDraft={changeDraft}
            onSubmit={onSave}
          />
          <ItemList
            items={items}
            loading={loading}
            error={loadError}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id === selectedId ? null : id)}
            onRemove={onRemove}
          />
        </section>
        <AskBox
          question={question}
          asking={asking}
          error={askError}
          result={result}
          onQuestion={changeQuestion}
          onSubmit={onAsk}
        />
      </div>
    </div>
  );
}
