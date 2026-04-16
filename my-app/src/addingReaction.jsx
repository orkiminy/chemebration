import React from "react";

// Renders a chemical formula string with subscript numbers and superscript charges.
// e.g. "H3O+" → H<sub>3</sub>O<sup>+</sup>
function renderChemical(str) {
  if (!str) return str;
  // Normalise unicode subscript/superscript digits to plain ASCII first
  const SUB_TO_PLAIN = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
  const s = str.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => SUB_TO_PLAIN[c] || c);

  const parts = [];
  // Match: subscript digits after a letter/closing paren, OR a charge (+/-) at the end of a token, OR prime marks ('/' after a letter)
  const re = /([A-Za-z\d)'']+?)(\d+)|([+-])(?=[A-Z()\s]|$)|(['']+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[2]) {
      // subscript: letter(s) followed by digits
      parts.push(m[1]);
      parts.push(
        <sub key={m.index} style={{ fontSize: "0.72em" }}>{m[2]}</sub>
      );
    } else if (m[3]) {
      // superscript charge: + or -
      parts.push(
        <sup key={m.index} style={{ fontSize: "0.72em" }}>{m[3]}</sup>
      );
    } else if (m[4]) {
      // superscript prime marks: ' or '
      parts.push(
        <sup key={m.index} style={{ fontSize: "0.72em" }}>{m[4]}</sup>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.length > 0 ? parts : s;
}

export default function ReactionArrow({ text, backwardText }) {
  // Split the text string "H₂ / Pt" into two parts: ["H₂", "Pt"]
  // If there is no slash, the bottom will just be empty.
  const [top, bottom] = text ? text.split("/").map(s => s.trim()) : ["", ""];
  const [backTop, backBottom] = backwardText ? backwardText.split("/").map(s => s.trim()) : ["", ""];

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "40px",
      fontFamily: "Arial",
      padding: "10px",
      justifyContent: "center",
      minWidth: "60px"
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Forward: Top Reagent */}
        <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "-5px" }}>
          {renderChemical(top)}
        </div>

        {/* Forward Arrow */}
        <svg width="160" height="24" viewBox="0 0 160 24">
          <line x1="4" y1="12" x2="138" y2="12" stroke="#333" strokeWidth="3.5" />
          <polygon points="138,5 158,12 138,19" fill="#333" />
        </svg>

        {/* Forward: Bottom Reagent */}
        <div style={{ fontWeight: "bold", fontSize: "14px", marginTop: "-5px" }}>
          {renderChemical(bottom)}
        </div>

        {/* Backward arrow + reagents (only for reversible reactions) */}
        {backwardText && (
          <>
            <div style={{ fontWeight: "bold", fontSize: "18px", marginTop: "6px", marginBottom: "-5px" }}>
              {renderChemical(backTop)}
            </div>
            <svg width="160" height="24" viewBox="0 0 160 24">
              <line x1="22" y1="12" x2="156" y2="12" stroke="#333" strokeWidth="3.5" />
              <polygon points="22,5 2,12 22,19" fill="#333" />
            </svg>
            <div style={{ fontWeight: "bold", fontSize: "14px", marginTop: "-5px" }}>
              {renderChemical(backBottom)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}