import type { PuzzleComponentProps } from '../../types';
import { ArchiveRoomScreen } from '../shared';

export default function RoomLedgerFastTrack({ campaignSessionKey, levelId }: PuzzleComponentProps) {
    return (
        <ArchiveRoomScreen
            campaignSessionKey={campaignSessionKey}
            levelId={levelId}
            translationPrefix="elem7.rooms.ledgerFastTrack"
            nextLevel="3"
            notes={[
                {
                    id: 'direct_review_slip',
                    titleKey: 'elem7.rooms.ledgerFastTrack.notes.directReviewSlip.title',
                    bodyKey: 'elem7.rooms.ledgerFastTrack.notes.directReviewSlip.body',
                },
                {
                    id: 'routing_brief',
                    titleKey: 'elem7.rooms.ledgerFastTrack.notes.routingBrief.title',
                    bodyKey: 'elem7.rooms.ledgerFastTrack.notes.routingBrief.body',
                },
            ]}
        />
    );
}