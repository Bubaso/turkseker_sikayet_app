import Link from "next/link";
import { DOC_TYPE_CODE, DOC_TYPE_LABEL, type DocType } from "@/lib/domain";
import { fmtDateTime } from "@/lib/dates";
import {requirePageUser} from "@/server/auth";
import { documentsAwaitingUser } from "@/server/documents";
import { Card, Chip, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PendingDocsPage() {
  const user = await requirePageUser();
  const docs = documentsAwaitingUser(user);

  return (
    <div className="space-y-5">
      <PageHeader
        title="İmza bekleyen belgeler"
        subtitle={
          docs.length > 0
            ? `${docs.length} belge ${user.title} unvanınızla imzanızı bekliyor`
            : `${user.title} unvanınıza düşen imza yok`
        }
      />

      {docs.length === 0 ? (
        <Card>
          <EmptyState
            title="İmza bekleyen belge yok"
            hint="Tutanak imza zincirinde sıra size geldiğinde belge burada listelenir. Zincir sıralıdır: önceki unvan imzalamadan sıra size gelmez."
          />
        </Card>
      ) : (
        <Card bodyClass="">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Belge</th><th>Şikâyet</th><th>Müşteri</th><th>Sıradaki imza</th>
                  <th>İlerleme</th><th>Düzenlenme</th><th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const signed = d.signatures.filter((s) => s.decision === "ONAY").length;
                  return (
                    <tr key={d.id}>
                      <td>
                        <span className="block font-medium text-ink-800">
                          {DOC_TYPE_LABEL[d.type as DocType] ?? d.type}
                        </span>
                        <span className="block text-xs text-ink-500">
                          {DOC_TYPE_CODE[d.type as DocType]} · {d.doc_no}
                        </span>
                      </td>
                      <td>
                        <Link href={`/panel/sikayet/${d.complaint_id}?sekme=belgeler`}
                              className="font-mono text-xs text-brand-700 hover:underline">
                          {d.complaint_no}
                        </Link>
                      </td>
                      <td className="max-w-[14rem] truncate text-ink-700">{d.customer_company}</td>
                      <td>
                        <Chip tone="warn" dot>{d.pending?.expected_title}</Chip>
                        {d.pending?.is_approval === 1 && (
                          <span className="ml-1.5"><Chip tone="brand">Onay</Chip></span>
                        )}
                      </td>
                      <td className="tnum">{signed} / {d.signatures.length}</td>
                      <td className="tnum text-xs text-ink-500">{fmtDateTime(d.created_at)}</td>
                      <td className="text-right">
                        <Link href={`/panel/sikayet/${d.complaint_id}?sekme=belgeler`}
                              className="btn btn-primary btn-sm">İmzala</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
