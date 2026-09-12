async function loadInventory(client, playerId) {
  const rows = await client.inventoryItem.findMany({ where: { playerId } });
  return Object.fromEntries(rows.map((row) => [row.itemId, row.quantity]));
}

async function saveInventory(client, playerId, items = {}) {
  await client.inventoryItem.deleteMany({ where: { playerId } });
  const rows = Object.entries(items).map(([itemId, quantity]) => ({
    playerId,
    itemId,
    quantity: Math.max(0, Number(quantity) || 0),
  }));
  if (rows.length) await client.inventoryItem.createMany({ data: rows });
}

module.exports = { loadInventory, saveInventory };
