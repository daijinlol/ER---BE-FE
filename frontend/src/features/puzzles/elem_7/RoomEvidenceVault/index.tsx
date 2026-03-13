import type { PuzzleComponentProps } from '../../types';
import { ArchiveRoomScreen } from '../shared';

export default function RoomEvidenceVault({ campaignSessionKey, levelId }: PuzzleComponentProps) {
    return (
        <ArchiveRoomScreen
            campaignSessionKey={campaignSessionKey}
            levelId={levelId}
            translationPrefix="elem7.rooms.evidenceVault"
            notes={[
                {
                    id: 'witness_note',
                    titleKey: 'elem7.rooms.evidenceVault.notes.witnessNote.title',
                    bodyKey: 'elem7.rooms.evidenceVault.notes.witnessNote.body',
                    rewardItem: 'witness_note',
                },
                {
                    id: 'district_overlay',
                    titleKey: 'elem7.rooms.evidenceVault.notes.districtOverlay.title',
                    bodyKey: 'elem7.rooms.evidenceVault.notes.districtOverlay.body',
                },
                {
                    id: 'seal_box',
                    titleKey: 'elem7.rooms.evidenceVault.notes.sealBox.title',
                    bodyKey: 'elem7.rooms.evidenceVault.notes.sealBox.body',
                },
            ]}
        />
    );
}