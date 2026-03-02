/**
 * chemistryUtils.js
 * Updated to strictly check for Bond Style (Solid vs Striped)
 */

function buildGraph(atoms, bonds) {
  const adjList = new Map();

  // Initialize atoms
  atoms.forEach(atom => {
    adjList.set(atom.id, {
      label: atom.label || "C", 
      connections: []
    });
  });

  // Add connections
  bonds.forEach(bond => {
    const fromNode = adjList.get(bond.from);
    const toNode = adjList.get(bond.to);
    
    // Default to "solid" if undefined so we don't crash on older data
    const style = bond.style || "solid"; 

    if (fromNode && toNode) {
      fromNode.connections.push({ 
        neighborId: bond.to, 
        order: bond.order, 
        style: style 
      });
      toNode.connections.push({ 
        neighborId: bond.from, 
        order: bond.order, 
        style: style 
      });
    }
  });

  return adjList;
}

export function checkIsomorphism(userAtoms, userBonds, solutionAtoms, solutionBonds) {
  // 1. Basic counts check
  if (userAtoms.length !== solutionAtoms.length) return false;
  if (userBonds.length !== solutionBonds.length) return false;

  const userGraph = buildGraph(userAtoms, userBonds);
  const solGraph = buildGraph(solutionAtoms, solutionBonds);

  // 2. Generate canonical signatures
  function getSignatures(graph) {
    let currentSigs = new Map();
    
    // Init: Signature is just the label (e.g. "C", "Br")
    for (const [id, node] of graph.entries()) {
      currentSigs.set(id, node.label);
    }

    // Iterate to blend neighbor info into the signature
    const refine = (sigs) => {
      const nextSigs = new Map();
      for (const [id, node] of graph.entries()) {
        const neighborSigs = node.connections.map(conn => {
          return `${conn.order}(${conn.style})-${sigs.get(conn.neighborId)}`;
        }).sort().join("|");
        nextSigs.set(id, `[${node.label}:${neighborSigs}]`);
      }
      return nextSigs;
    };
    for (let i = 0; i < 3; i++) {
      currentSigs = refine(currentSigs);
    }

    return Array.from(currentSigs.values()).sort();
  }

  const userFingerprint = getSignatures(userGraph);
  const solFingerprint = getSignatures(solGraph);

  // 3. Compare
  return JSON.stringify(userFingerprint) === JSON.stringify(solFingerprint);
}