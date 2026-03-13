import type { PuzzleComponentProps } from '../../types';
import { ArchiveRoomScreen } from '../shared';

export default function RoomLedgerReview({ campaignSessionKey, levelId }: PuzzleComponentProps) {
    return (
        <ArchiveRoomScreen
            campaignSessionKey={campaignSessionKey}
            levelId={levelId}
            translationPrefix="elem7.rooms.ledgerReview"
            nextLevel="3"
            notes={[
                {
                    id: 'secondary_review_notice',
                    titleKey: 'elem7.rooms.ledgerReview.notes.secondaryReviewNotice.title',
                    bodyKey: 'elem7.rooms.ledgerReview.notes.secondaryReviewNotice.body',
                },
                {
                    id: 'procedure_warning',
                    titleKey: 'elem7.rooms.ledgerReview.notes.procedureWarning.title',
                    bodyKey: 'elem7.rooms.ledgerReview.notes.procedureWarning.body',
                },
            ]}
        />
    );
}