function httpsUrl(value) {
  if (!value || typeof value !== 'string') return null;
  // GitHub Pages is HTTPS. The API currently returns http:// image URLs, so
  // upgrade them to HTTPS to avoid browser mixed-content blocking.
  return value.replace(/^http:\/\//i, 'https://');
}

function avatarFromPhotoId(photoId) {
  if (!photoId || typeof photoId !== 'string') return null;
  const parts = photoId.split('|');
  return httpsUrl(parts.find((part) => /^https?:\/\//i.test(part)) || null);
}

function cleanNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeMoment(moment) {
  const images = [];
  for (let i = 1; i <= 6; i += 1) {
    const url = httpsUrl(moment[`pic${i}`]);
    if (url) images.push(url);
  }

  return {
    momentId: String(moment.momentId ?? ''),
    author: {
      roleId: String(moment.roleId ?? ''),
      serverId: String(moment.serverId ?? ''),
      roleName: String(moment.roleName ?? ''),
      avatarUrl: avatarFromPhotoId(moment.photoId),
    },
    title: String(moment.title ?? ''),
    content: String(moment.content ?? ''),
    images,
    createdAt: cleanNumber(moment.createTime),
    stats: {
      votes: cleanNumber(moment.voteSize),
      replies: cleanNumber(moment.totalReplySize ?? moment.replySize),
      collections: cleanNumber(moment.collectionSize),
    },
    labels: String(moment.labelList ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    flags: {
      nominated: Boolean(moment.nominated),
      hot: Boolean(moment.hotStatus),
      secret: Boolean(moment.secret),
      deleted: Boolean(moment.deleted),
    },
  };
}
