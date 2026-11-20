export default function SaveBox({ mode, draft, saving, error, onMode, onDraft, onSubmit }) {
  return (
    <form className="pane" onSubmit={onSubmit}>
      <div className="pane-head">
        <h2>Save</h2>
        <div className="switch" role="tablist" aria-label="What to save">
          <button type="button" className={mode === 'note' ? 'on' : ''} onClick={() => onMode('note')}>
            Note
          </button>
          <button type="button" className={mode === 'url' ? 'on' : ''} onClick={() => onMode('url')}>
            Link
          </button>
        </div>
      </div>
      {mode === 'note' ? (
        <textarea
          value={draft}
          onChange={event => onDraft(event.target.value)}
          onKeyDown={cmdEnter}
          placeholder="Something you want to find later"
          aria-label="Note"
        />
      ) : (
        <input
          type="url"
          value={draft}
          onChange={event => onDraft(event.target.value)}
          onKeyDown={cmdEnter}
          placeholder="https://"
          aria-label="Link"
          autoComplete="off"
          spellCheck="false"
        />
      )}
      {error && <p className="err" role="alert">{error}</p>}
      <div className="row">
        <button className="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <span className="hint">Ctrl+Enter</span>
      </div>
    </form>
  );
}

function cmdEnter(event) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}
