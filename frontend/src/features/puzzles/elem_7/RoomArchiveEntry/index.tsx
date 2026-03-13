import type { PuzzleComponentProps } from '../../types';
import { ArchiveRoomScreen } from '../shared';

export default function RoomArchiveEntry({ campaignSessionKey, levelId }: PuzzleComponentProps) {
    return (
        <ArchiveRoomScreen
            campaignSessionKey={campaignSessionKey}
            levelId={levelId}
            translationPrefix="elem7.rooms.archiveEntry"
            notes={[
                {
                    id: 'mayor_notice',
                    titleKey: 'elem7.rooms.archiveEntry.notes.mayorNotice.title',
                    bodyKey: 'elem7.rooms.archiveEntry.notes.mayorNotice.body',
                    rewardItem: 'archive_notice',
                },
                {
                    id: 'shelf_guide',
                    titleKey: 'elem7.rooms.archiveEntry.notes.shelfGuide.title',
                    bodyKey: 'elem7.rooms.archiveEntry.notes.shelfGuide.body',
                    rewardItem: 'shelf_guide',
                },
                {
                    id: 'water_log',
                    titleKey: 'elem7.rooms.archiveEntry.notes.waterLog.title',
                    bodyKey: 'elem7.rooms.archiveEntry.notes.waterLog.body',
                },
            ]}
        />
    );
}