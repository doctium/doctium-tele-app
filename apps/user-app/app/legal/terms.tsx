import { useTranslation } from "react-i18next";
import { LegalScreen } from "../../src/components/common/LegalScreen";
import { TERMS } from "../../src/content/legal";

export default function TermsScreen() {
  const { t } = useTranslation();
  return <LegalScreen title={t("profile.terms")} blocks={TERMS} />;
}
