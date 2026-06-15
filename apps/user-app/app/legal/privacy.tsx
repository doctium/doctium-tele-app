import { useTranslation } from "react-i18next";
import { LegalScreen } from "../../src/components/common/LegalScreen";
import { PRIVACY } from "../../src/content/legal";

export default function PrivacyScreen() {
  const { t } = useTranslation();
  return <LegalScreen title={t("profile.privacy")} blocks={PRIVACY} />;
}
