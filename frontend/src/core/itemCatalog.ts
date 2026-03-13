export type InventoryItemKind = 'document' | 'tool' | 'artifact';

interface InventoryItemCatalogEntry {
    kind: InventoryItemKind;
    readable: boolean;
    summaryKey: string;
    bodyKey?: string;
}

const defaultItemCatalogEntry: InventoryItemCatalogEntry = {
    kind: 'artifact',
    readable: false,
    summaryKey: 'inventory.defaultSummary',
};

export const itemCatalog: Record<string, InventoryItemCatalogEntry> = {
    module_ram: {
        kind: 'tool',
        readable: true,
        summaryKey: 'itemDetails.module_ram.summary',
        bodyKey: 'itemDetails.module_ram.body',
    },
    module_loop: {
        kind: 'tool',
        readable: true,
        summaryKey: 'itemDetails.module_loop.summary',
        bodyKey: 'itemDetails.module_loop.body',
    },
    usb_decryptor: {
        kind: 'tool',
        readable: true,
        summaryKey: 'itemDetails.usb_decryptor.summary',
        bodyKey: 'itemDetails.usb_decryptor.body',
    },
    storage: {
        kind: 'artifact',
        readable: false,
        summaryKey: 'itemDetails.storage.summary',
    },
    sector_map: {
        kind: 'artifact',
        readable: true,
        summaryKey: 'itemDetails.sector_map.summary',
        bodyKey: 'itemDetails.sector_map.body',
    },
    flight_chip: {
        kind: 'tool',
        readable: true,
        summaryKey: 'itemDetails.flight_chip.summary',
        bodyKey: 'itemDetails.flight_chip.body',
    },
    archive_notice: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.archive_notice.summary',
        bodyKey: 'itemDetails.archive_notice.body',
    },
    shelf_guide: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.shelf_guide.summary',
        bodyKey: 'itemDetails.shelf_guide.body',
    },
    clerk_index: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.clerk_index.summary',
        bodyKey: 'itemDetails.clerk_index.body',
    },
    ledger_bundle: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.ledger_bundle.summary',
        bodyKey: 'itemDetails.ledger_bundle.body',
    },
    wax_seal: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.wax_seal.summary',
        bodyKey: 'itemDetails.wax_seal.body',
    },
    routing_stamp: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.routing_stamp.summary',
        bodyKey: 'itemDetails.routing_stamp.body',
    },
    witness_note: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.witness_note.summary',
        bodyKey: 'itemDetails.witness_note.body',
    },
    district_map: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.district_map.summary',
        bodyKey: 'itemDetails.district_map.body',
    },
    charter_fragment: {
        kind: 'document',
        readable: true,
        summaryKey: 'itemDetails.charter_fragment.summary',
        bodyKey: 'itemDetails.charter_fragment.body',
    },
};

export function getInventoryItemCatalogEntry(itemId: string): InventoryItemCatalogEntry {
    return itemCatalog[itemId] ?? defaultItemCatalogEntry;
}