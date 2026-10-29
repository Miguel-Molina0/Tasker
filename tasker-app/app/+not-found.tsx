import React from "react";
import { Shell, Empty, go } from "../src/ui";
export default function NotFound() {
  return (
    <Shell title="Página não encontrada" publicPage>
      <Empty
        title="Vamos voltar ao início?"
        text="Este caminho não está disponível."
        action="Abrir início"
        onPress={() => go("")}
      />
    </Shell>
  );
}
