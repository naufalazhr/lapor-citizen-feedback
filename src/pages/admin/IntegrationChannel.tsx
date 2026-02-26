import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * IntegrationChannel — redirect hub.
 * The channel page is now split into three sub-pages:
 *   /admin/integration/channel/ai-agent
 *   /admin/integration/channel/whatsapp
 *   /admin/integration/channel/ai-insight
 * This component immediately redirects to the first sub-page.
 */
const IntegrationChannel = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/admin/integration/channel/ai-agent", { replace: true });
  }, [navigate]);

  return null;
};

export default IntegrationChannel;