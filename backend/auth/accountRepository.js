const { normalizeEmail } = require("./password");

async function claimLegacyPlayer({
  prisma,
  email: emailValue,
  legacyPlayerId = "local-player",
}) {
  const email = normalizeEmail(emailValue);
  if (!email) return { error: "A target account email is required." };
  return prisma.$transaction(async (transaction) => {
    const markerKey = `legacy-claim:${legacyPlayerId}`;
    const existingClaim = await transaction.persistenceMetadata.findUnique({
      where: { key: markerKey },
    });
    if (existingClaim) return { error: "The legacy save has already been claimed." };
    const user = await transaction.user.findUnique({
      where: { email },
      include: { player: true },
    });
    if (!user) return { error: "The target account does not exist." };
    const legacyPlayer = await transaction.player.findUnique({
      where: { id: legacyPlayerId },
    });
    if (!legacyPlayer) return { error: "The imported local-player save does not exist." };
    if (legacyPlayer.userId) return { error: "The legacy save is already attached." };
    if (user.player && user.player.id !== legacyPlayerId) {
      await transaction.player.delete({ where: { id: user.player.id } });
    }
    await transaction.player.update({
      where: { id: legacyPlayerId },
      data: { userId: user.id },
    });
    await transaction.persistenceMetadata.create({
      data: {
        key: markerKey,
        value: {
          claimedByUserId: user.id,
          claimedByEmail: user.email,
          claimedAt: new Date().toISOString(),
        },
      },
    });
    return { success: true, userId: user.id, playerId: legacyPlayerId };
  });
}

module.exports = { claimLegacyPlayer };
