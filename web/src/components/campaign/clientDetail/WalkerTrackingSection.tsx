import React from "react";
import DeliveryTrackingPanel from "../DeliveryTrackingPanel";
import type { CampaignData } from "../../../models/campaign";

type PanelProps = React.ComponentProps<typeof DeliveryTrackingPanel>;

interface WalkerTrackingSectionProps
  extends Omit<PanelProps, "doorRadiusM" | "junkMailPolicy" | "propertyFilter"> {
  campaign: CampaignData;
}

/** The assigned walker's GPS delivery controls, configured from the campaign's radius and mail rules. */
const WalkerTrackingSection: React.FC<WalkerTrackingSectionProps> = ({ campaign, ...panel }) => (
  <DeliveryTrackingPanel
    doorRadiusM={campaign.doorRadiusM || 100}
    junkMailPolicy={campaign.junkMailPolicy}
    propertyFilter={campaign.propertyFilter}
    {...panel}
  />
);

export default WalkerTrackingSection;
