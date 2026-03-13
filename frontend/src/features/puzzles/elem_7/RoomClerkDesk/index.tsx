import type { PuzzleComponentProps } from '../../types';
import { ArchiveRoomScreen } from '../shared';

export default function RoomClerkDesk({ campaignSessionKey, levelId }: PuzzleComponentProps) {
    return (
        <ArchiveRoomScreen
            campaignSessionKey={campaignSessionKey}
            levelId={levelId}
            translationPrefix="elem7.rooms.clerkDesk"
            notes={[
                {
                    id: 'clerk_diary',
                    titleKey: 'elem7.rooms.clerkDesk.notes.clerkDiary.title',
                    bodyKey: 'elem7.rooms.clerkDesk.notes.clerkDiary.body',
                    rewardItem: 'wax_seal',
                },
                {
                    id: 'index_manual',
                    titleKey: 'elem7.rooms.clerkDesk.notes.indexManual.title',
                    bodyKey: 'elem7.rooms.clerkDesk.notes.indexManual.body',
                },
                {
                    id: 'margin_note',
                    titleKey: 'elem7.rooms.clerkDesk.notes.marginNote.title',
                    bodyKey: 'elem7.rooms.clerkDesk.notes.marginNote.body',
                },
            ]}
        />
    );
}