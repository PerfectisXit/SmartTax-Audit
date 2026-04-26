import {
  DuplicateConfidence,
  DuplicateStatus,
  DuplicateGroup,
  TravelBatchItem,
  TravelDedupSummary,
  TravelExpenseType,
} from '../types';

type IndexedItem = {
  index: number;
  item: TravelBatchItem;
  fileHash: string;
  effectiveTravelDate: string;
};

type DuplicateEdge = {
  leftId: string;
  rightId: string;
  reason: string;
  confidence: DuplicateConfidence;
};

const DOCUMENT_PRIORITY: Record<string, number> = {
  vat_invoice: 6,
  flight_itinerary: 5,
  train_ticket: 5,
  taxi_receipt: 5,
  screenshot: 4,
  boarding_pass: 3,
  other: 1,
};

const CONFIRMED_DUPLICATE_STATUSES: DuplicateStatus[] = ['confirmed_duplicate', 'confirmed_distinct'];

const normalizeText = (value?: string | null): string => (value || '').trim().toLowerCase();

const normalizeAmount = (value?: number): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

const normalizeTime = (value?: string | null): string => {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const toMinutes = (value: string): number | null => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const isTimeWithinMinutes = (left?: string | null, right?: string | null, maxDiffMinutes = 120): boolean => {
  const leftTime = toMinutes(normalizeTime(left));
  const rightTime = toMinutes(normalizeTime(right));
  if (leftTime == null || rightTime == null) return false;
  return Math.abs(leftTime - rightTime) <= maxDiffMinutes;
};

const getEffectiveTravelDate = (item: TravelBatchItem): string => {
  return normalizeText(item.result?.travelMeta?.travelDate) || normalizeText(item.result?.invoiceDate);
};

const getDocumentPriority = (item: TravelBatchItem): number => {
  return DOCUMENT_PRIORITY[item.result?.documentType || 'other'] || 0;
};

const getCompletenessScore = (item: TravelBatchItem): number => {
  const meta = item.result?.travelMeta;
  if (!meta) return 0;
  const fields = [
    meta.travelDate,
    meta.travelTime,
    meta.origin,
    meta.destination,
    meta.tripNumber,
    meta.platform,
    meta.orderRef,
    meta.hotelName,
  ];
  return fields.filter((value) => normalizeText(value).length > 0).length;
};

const createFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
};

const isExactDuplicate = (left: IndexedItem, right: IndexedItem): DuplicateEdge | null => {
  if (!left.fileHash || !right.fileHash || left.fileHash !== right.fileHash) return null;
  return {
    leftId: left.item.id,
    rightId: right.item.id,
    reason: '文件内容完全相同',
    confidence: 'exact',
  };
};

const isFlightOrTrainDuplicate = (left: IndexedItem, right: IndexedItem): DuplicateEdge | null => {
  const leftResult = left.item.result;
  const rightResult = right.item.result;
  if (!leftResult || !rightResult) return null;
  if (leftResult.expenseType !== rightResult.expenseType) return null;
  if (![TravelExpenseType.FLIGHT, TravelExpenseType.TRAIN].includes(leftResult.expenseType)) return null;
  if (!left.effectiveTravelDate || left.effectiveTravelDate !== right.effectiveTravelDate) return null;

  const leftMeta = leftResult.travelMeta;
  const rightMeta = rightResult.travelMeta;
  const tripNumberMatch =
    normalizeText(leftMeta?.tripNumber).length > 0 &&
    normalizeText(leftMeta?.tripNumber) === normalizeText(rightMeta?.tripNumber);
  const routeMatch =
    normalizeText(leftMeta?.origin).length > 0 &&
    normalizeText(leftMeta?.origin) === normalizeText(rightMeta?.origin) &&
    normalizeText(leftMeta?.destination).length > 0 &&
    normalizeText(leftMeta?.destination) === normalizeText(rightMeta?.destination);
  const timeMatch = isTimeWithinMinutes(leftMeta?.travelTime, rightMeta?.travelTime, 120);

  if (!tripNumberMatch && !routeMatch && !timeMatch) return null;

  const reasonParts: string[] = [`同一${leftResult.expenseType}`];
  if (tripNumberMatch) reasonParts.push('票号/航班车次一致');
  if (routeMatch) reasonParts.push('路线一致');
  if (timeMatch) reasonParts.push('时间接近');

  return {
    leftId: left.item.id,
    rightId: right.item.id,
    reason: reasonParts.join('，'),
    confidence: 'high',
  };
};

const isTaxiDuplicate = (left: IndexedItem, right: IndexedItem): DuplicateEdge | null => {
  const leftResult = left.item.result;
  const rightResult = right.item.result;
  if (!leftResult || !rightResult) return null;
  if (leftResult.expenseType !== TravelExpenseType.TAXI || rightResult.expenseType !== TravelExpenseType.TAXI) return null;
  if (!left.effectiveTravelDate || left.effectiveTravelDate !== right.effectiveTravelDate) return null;

  const leftMeta = leftResult.travelMeta;
  const rightMeta = rightResult.travelMeta;
  const timeMatch =
    normalizeTime(leftMeta?.travelTime).length > 0 &&
    normalizeTime(leftMeta?.travelTime) === normalizeTime(rightMeta?.travelTime);
  if (!timeMatch) return null;

  const amountMatch = normalizeAmount(leftResult.totalAmount) === normalizeAmount(rightResult.totalAmount);
  if (!amountMatch) return null;

  const platformMatch =
    normalizeText(leftMeta?.platform).length > 0 &&
    normalizeText(leftMeta?.platform) === normalizeText(rightMeta?.platform);
  const orderRefMatch =
    normalizeText(leftMeta?.orderRef).length > 0 &&
    normalizeText(leftMeta?.orderRef) === normalizeText(rightMeta?.orderRef);
  if (!platformMatch && !orderRefMatch) return null;

  return {
    leftId: left.item.id,
    rightId: right.item.id,
    reason: '同一市内交通事件：日期、时间、金额及平台/订单号一致',
    confidence: 'high',
  };
};

const isAccommodationDuplicate = (left: IndexedItem, right: IndexedItem): DuplicateEdge | null => {
  const leftResult = left.item.result;
  const rightResult = right.item.result;
  if (!leftResult || !rightResult) return null;
  if (leftResult.expenseType !== TravelExpenseType.ACCOMMODATION || rightResult.expenseType !== TravelExpenseType.ACCOMMODATION) return null;
  if (!left.effectiveTravelDate || left.effectiveTravelDate !== right.effectiveTravelDate) return null;

  const leftMeta = leftResult.travelMeta;
  const rightMeta = rightResult.travelMeta;
  const hotelMatch =
    normalizeText(leftMeta?.hotelName).length > 0 &&
    normalizeText(leftMeta?.hotelName) === normalizeText(rightMeta?.hotelName);
  const amountMatch = normalizeAmount(leftResult.totalAmount) === normalizeAmount(rightResult.totalAmount);
  const orderRefMatch =
    normalizeText(leftMeta?.orderRef).length > 0 &&
    normalizeText(leftMeta?.orderRef) === normalizeText(rightMeta?.orderRef);

  if (!hotelMatch || !amountMatch || !orderRefMatch) return null;

  return {
    leftId: left.item.id,
    rightId: right.item.id,
    reason: '同一住宿事件：酒店、日期、金额和订单号一致',
    confidence: 'high',
  };
};

const buildDuplicateEdge = (left: IndexedItem, right: IndexedItem): DuplicateEdge | null => {
  return (
    isExactDuplicate(left, right) ||
    isFlightOrTrainDuplicate(left, right) ||
    isTaxiDuplicate(left, right) ||
    isAccommodationDuplicate(left, right)
  );
};

const shouldWinPrimary = (candidate: IndexedItem, current: IndexedItem): boolean => {
  const candidateAmountPositive = normalizeAmount(candidate.item.result?.totalAmount) > 0;
  const currentAmountPositive = normalizeAmount(current.item.result?.totalAmount) > 0;
  if (candidateAmountPositive !== currentAmountPositive) return candidateAmountPositive;

  const candidatePriority = getDocumentPriority(candidate.item);
  const currentPriority = getDocumentPriority(current.item);
  if (candidatePriority !== currentPriority) return candidatePriority > currentPriority;

  const candidateCompleteness = getCompletenessScore(candidate.item);
  const currentCompleteness = getCompletenessScore(current.item);
  if (candidateCompleteness !== currentCompleteness) return candidateCompleteness > currentCompleteness;

  return candidate.index < current.index;
};

const buildGroups = (items: IndexedItem[], edges: DuplicateEdge[]): Array<{ ids: string[]; edgeMeta: DuplicateEdge[] }> => {
  const adjacency = new Map<string, Set<string>>();
  const edgeMap = new Map<string, DuplicateEdge[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.leftId)) adjacency.set(edge.leftId, new Set());
    if (!adjacency.has(edge.rightId)) adjacency.set(edge.rightId, new Set());
    adjacency.get(edge.leftId)!.add(edge.rightId);
    adjacency.get(edge.rightId)!.add(edge.leftId);

    const key = [edge.leftId, edge.rightId].sort().join('::');
    const list = edgeMap.get(key) || [];
    list.push(edge);
    edgeMap.set(key, list);
  }

  const visited = new Set<string>();
  const groups: Array<{ ids: string[]; edgeMeta: DuplicateEdge[] }> = [];
  for (const item of items) {
    if (!adjacency.has(item.item.id) || visited.has(item.item.id)) continue;
    const queue = [item.item.id];
    const ids: string[] = [];
    const localEdgeMeta: DuplicateEdge[] = [];
    visited.add(item.item.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      ids.push(current);
      for (const next of adjacency.get(current) || []) {
        const key = [current, next].sort().join('::');
        const meta = edgeMap.get(key);
        if (meta) localEdgeMeta.push(...meta);
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    if (ids.length > 1) {
      groups.push({ ids, edgeMeta: localEdgeMeta });
    }
  }
  return groups;
};

const buildGroupReason = (edges: DuplicateEdge[]): { reason: string; confidence: DuplicateConfidence } => {
  const exact = edges.find((edge) => edge.confidence === 'exact');
  if (exact) return { reason: exact.reason, confidence: 'exact' };
  return {
    reason: edges[0]?.reason || '同一出行事件',
    confidence: 'high',
  };
};

export const analyzeTravelDuplicates = async (
  items: TravelBatchItem[]
): Promise<{ items: TravelBatchItem[]; summary: TravelDedupSummary }> => {
  const hashedItems = await Promise.all(
    items.map(async (item, index) => ({
      index,
      item,
      fileHash: item.fileHash || await createFileHash(item.file),
      effectiveTravelDate: getEffectiveTravelDate(item),
    }))
  );

  const successItems = hashedItems.filter(({ item }) => item.status === 'success' && item.result);
  const edges: DuplicateEdge[] = [];

  for (let leftIndex = 0; leftIndex < successItems.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < successItems.length; rightIndex += 1) {
      const edge = buildDuplicateEdge(successItems[leftIndex], successItems[rightIndex]);
      if (edge) edges.push(edge);
    }
  }

  const grouped = buildGroups(successItems, edges);
  const metaByItemId = new Map<string, Partial<TravelBatchItem>>();
  const duplicateGroups: DuplicateGroup[] = [];
  let estimatedSavings = 0;

  for (const [groupIndex, group] of grouped.entries()) {
    const members = group.ids
      .map((id) => successItems.find((entry) => entry.item.id === id))
      .filter((entry): entry is IndexedItem => Boolean(entry));
    if (members.length < 2) continue;

    let primary = members[0];
    for (const candidate of members.slice(1)) {
      if (shouldWinPrimary(candidate, primary)) {
        primary = candidate;
      }
    }

    const { reason, confidence } = buildGroupReason(group.edgeMeta);
    const groupId = `duplicate-group-${groupIndex + 1}`;
    const memberIds = members.map((entry) => entry.item.id);

    let groupSavings = 0;
    for (const member of members) {
      if (member.item.id === primary.item.id) {
        metaByItemId.set(member.item.id, {
          fileHash: member.fileHash,
          duplicateGroupId: groupId,
          duplicatePrimaryId: primary.item.id,
          duplicateReason: reason,
          duplicateConfidence: confidence,
          duplicateStatus: 'none',
        });
        continue;
      }

      const existingStatus = member.item.duplicateStatus;
      const duplicateStatus = CONFIRMED_DUPLICATE_STATUSES.includes(existingStatus as DuplicateStatus)
        ? existingStatus
        : 'pending_review';

      if (duplicateStatus === 'pending_review') {
        groupSavings += normalizeAmount(member.item.result?.totalAmount);
      }

      metaByItemId.set(member.item.id, {
        fileHash: member.fileHash,
        duplicateGroupId: groupId,
        duplicatePrimaryId: primary.item.id,
        duplicateReason: reason,
        duplicateConfidence: confidence,
        duplicateStatus,
      });
    }

    duplicateGroups.push({
      groupId,
      primaryId: primary.item.id,
      memberIds,
      reason,
      confidence,
      estimatedDuplicateAmount: groupSavings,
    });
    estimatedSavings += groupSavings;
  }

  const nextItems = hashedItems.map(({ item, fileHash }) => {
    const meta = metaByItemId.get(item.id);
    if (!meta) {
      return {
        ...item,
        fileHash,
        duplicateGroupId: undefined,
        duplicatePrimaryId: undefined,
        duplicateReason: undefined,
        duplicateConfidence: undefined,
        duplicateStatus: 'none' as DuplicateStatus,
      };
    }
    return {
      ...item,
      fileHash,
      duplicateGroupId: meta.duplicateGroupId,
      duplicatePrimaryId: meta.duplicatePrimaryId,
      duplicateReason: meta.duplicateReason,
      duplicateConfidence: meta.duplicateConfidence,
      duplicateStatus: meta.duplicateStatus as DuplicateStatus,
    };
  });

  return {
    items: nextItems,
    summary: {
      duplicateGroups,
      duplicateGroupCount: duplicateGroups.length,
      estimatedSavings,
    },
  };
};
