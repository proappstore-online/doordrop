import React from "react";
import AddressSelectionPanel from "../AddressSelectionPanel";
import DoorList from "../DoorList";
import type { CampaignData } from "../../../models/campaign";
import type { useDoorManagement } from "../../../hooks/useDoorManagement";

type DoorListProps = React.ComponentProps<typeof DoorList>;

interface DoorManagementPanelsProps extends Omit<DoorListProps, "campaignId"> {
  campaignId: string;
  campaign: CampaignData;
  doorManagement: ReturnType<typeof useDoorManagement>;
  /** Shown for an admin on a draft campaign only, per the caller's layout. */
  showAddressSelection: boolean;
}

/**
 * Address picking (streets from OpenStreetMap, then individual addresses) and the per-street door list.
 * Rendered inside the caller's column.
 */
const DoorManagementPanels: React.FC<DoorManagementPanelsProps> = ({
  campaignId,
  campaign,
  doorManagement,
  showAddressSelection,
  ...doorList
}) => (
  <>
    {showAddressSelection && (
      <AddressSelectionPanel
        suburb={campaign.suburb || ""}
        postcode={campaign.postcode || ""}
        state={campaign.state || ""}
        currentStreet={doorManagement.currentStreet}
        availableAddresses={doorManagement.availableAddresses}
        selectedDoorKeys={doorManagement.selectedDoorKeys}
        overpassLoading={doorManagement.overpassLoading}
        overpassError={doorManagement.overpassError}
        manualOpen={doorManagement.manualOpen}
        onStreetSelected={doorManagement.handleStreetSelected}
        onToggleAddress={doorManagement.toggleAddress}
        onToggleManual={() => doorManagement.setManualOpen(!doorManagement.manualOpen)}
        onDoorsGenerated={doorManagement.handleDoorsGenerated}
      />
    )}
    <DoorList campaignId={campaignId} {...doorList} />
  </>
);

export default DoorManagementPanels;
