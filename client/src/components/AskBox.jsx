export default function AskBox({ question, asking, error, result, onQuestion, onSubmit }) {
  return (
    <main className="main">
      <form onSubmit={onSubmit}>
        <label className="ask-label" htmlFor="question">Ask</label>
        <textarea
          id="question"
          value={question}
          onChange={event => onQuestion(event.target.value)}
          onKeyDown={cmdEnter}
          placeholder="Ask about what you've saved"
        />
        {error && <p className="err" role="alert">{error}</p>}
        <div className="row">
          <button className="primary" type="submit" disabled={asking}>
            {asking ? 'Asking…' : 'Ask'}
          </button>
          <span className="hint">Ctrl+Enter</span>
        </div>
      </form>

      {result && (
        <article className="answer">
          <AnswerText text={result.answer} />
          {result.sources?.length > 0 && (
            <ol className="sources">
              {result.sources.map((source, index) => (
                <li key={source.chunkId}>
                  <div className="src-top">
                    <strong>[{index + 1}] {source.title}</strong>
                    <span className="meta" title="cosine similarity">{source.score.toFixed(2)}</span>
                  </div>
                  {source.url && (
                    <a className="src-link" href={source.url} target="_blank" rel="noreferrer">
                      {hostname(source.url)}
                    </a>
                  )}
                  <blockquote>{source.text}</blockquote>
                </li>
              ))}
            </ol>
          )}
        </article>
      )}
    </main>
  );
}

function AnswerText({ text }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p>
      {parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) return <sup key={index} className="cite">{match[1]}</sup>;
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

function hostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function cmdEnter(event) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}
