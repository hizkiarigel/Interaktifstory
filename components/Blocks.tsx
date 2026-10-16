import type { Block } from "@/lib/parser";

export function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case "p":
      return <p className="p">{b.text}</p>;
    case "dialog":
      return (
        <p className="p dlg">
          {b.speaker}
          {b.dir ? (b.paren ? ` (${b.dir})` : `, ${b.dir}`) : ""}: “{b.text}”
        </p>
      );
    case "phone":
      return (
        <div className="phone" role="group" aria-label={b.title ? `Pesan HP: ${b.title}` : "Pesan HP"}>
          {b.title && <div className="phone-title">{b.title}</div>}
          {b.msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.me ? "me" : "them"}`}>
              <span className="who">
                {m.from}
                {m.time ? ` · ${m.time}` : ""}
              </span>
              {m.text}
            </div>
          ))}
        </div>
      );
    case "call":
      return <p className="call">📞 {b.text}</p>;
    case "feed":
      return (
        <article className="feed">
          <div className="feed-head">
            <strong>{b.handle}</strong>
            {b.meta && <span>{b.meta}</span>}
          </div>
          {b.body && <p>{b.body}</p>}
          {b.comments.length > 0 && (
            <ul>
              {b.comments.map((c, i) => (
                <li key={i}>
                  <strong>{c.user}</strong> {c.text}
                </li>
              ))}
            </ul>
          )}
        </article>
      );
    case "system":
      return (
        <aside className="sys">
          <div className="sys-title">{b.title}</div>
          {b.lines.map((l, i) => (
            <div key={i} className={i === 0 && b.rows ? "sys-sub" : undefined}>
              {l}
            </div>
          ))}
          {b.rows && (
            <div className="sys-rows" role="table">
              {b.rows.map((r, i) => (
                <div key={i} className={`row${i === 0 ? " head" : ""}`} role="row">
                  {r.map((c, j) => (
                    <span key={j} role="cell">
                      {c}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
          {b.note && <div className="sys-note">{b.note}</div>}
        </aside>
      );
    case "email":
      return (
        <p className="email">
          <span>Subject</span> {b.subject}
        </p>
      );
    case "caps":
      return <p className="caps">{b.text}</p>;
    case "cut":
      return <p className="cut">{b.text}</p>;
    case "rows":
      return (
        <div className={`rows ${b.variant}`} role="table">
          {b.rows.map((r, i) => (
            <div key={i} className="row" role="row">
              {r.map((c, j) => (
                <span key={j} role="cell">
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
      );
  }
}
