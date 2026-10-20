import React from "react";
import CampaignDetailsEditor from "../CampaignDetailsEditor";
import type { CampaignData } from "../../../models/campaign";

type EditorProps = React.ComponentProps<typeof CampaignDetailsEditor>;

interface CampaignDetailsSectionProps extends Omit<EditorProps, "publishDisabled"> {
  campaign: CampaignData;
  statusUpdating: boolean;
  isPublishing: boolean;
}

/**
 * The admin's budget, due date, radius and publish controls for a draft or ready campaign.
 * Publish is disabled until the campaign has what it needs to go out.
 */
const CampaignDetailsSection: React.FC<CampaignDetailsSectionProps> = ({
  campaign,
  statusUpdating,
  isPublishing,
  ...editor
}) => {
  const publishDisabled =
    statusUpdating ||
    isPublishing ||
    editor.doorCount === 0 ||
    !campaign.activePrintoutId ||
    !campaign.doorRadiusM ||
    campaign.doorRadiusM <= 0 ||
    !campaign.suburb ||
    !campaign.postcode;

  return <CampaignDetailsEditor {...editor} publishDisabled={publishDisabled} />;
};

export default CampaignDetailsSection;
