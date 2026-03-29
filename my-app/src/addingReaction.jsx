import React from "react";
import { autoSubscript } from "./engine/reactionRules";

export default function ReactionArrow({ text }) {
  // Split the text string "H₂ / Pt" into two parts: ["H₂", "Pt"]
  // If there is no slash, the bottom will just be empty.
  const [top, bottom] = text ? text.split("/").map(s => s.trim()) : ["", ""];

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "40px",
      fontFamily: "Arial",
      padding: "10px",
      // Removed border/background so it looks cleaner between the canvases
      justifyContent: "center",
      minWidth: "60px" 
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Top Reagent (e.g. H₂) */}
        <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "-5px" }}>
          {autoSubscript(top)}
        </div>
        
        {/* The Arrow */}
        <div style={{ fontSize: "28px", fontWeight: "bold", color: "#333" }}>→</div>
        
        {/* Bottom Reagent (e.g. Pt) */}
        <div style={{ fontWeight: "bold", fontSize: "14px", marginTop: "-5px" }}>
          {autoSubscript(bottom)}
        </div>
      </div>
    </div>
  );
}