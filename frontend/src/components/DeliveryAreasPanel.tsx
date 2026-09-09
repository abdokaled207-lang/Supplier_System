import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { DeliveryArea } from "../api/types";
import { InlineError } from "./InlineError";
import { fieldClass } from "../utils/forms";

// Admin-managed list of delivery regions. The customer form uses this list as
// its Region dropdown; the order here is the display order there.
export function DeliveryAreasPanel() {
  const qc = useQueryClient();
  const areas = useQuery({
    queryKey: ["delivery-areas"],
    queryFn: () => api.get<{ data: DeliveryArea[] }>("/delivery-areas"),
  });

  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<DeliveryArea | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["delivery-areas"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
  };

  const create = useMutation({
    mutationFn: (body: { name: string }) => api.post("/delivery-areas", body),
    onSuccess: () => {
      invalidate();
      setName("");
      setFormError(null);
    },
    onError: (err: { message?: string }) => setFormError(err?.message ?? "Could not add the area."),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.put(`/delivery-areas/${id}`, { name }),
    onSuccess: () => {
      invalidate();
      setRenaming(null);
    },
    onError: (err: { message?: string }) => setFormError(err?.message ?? "Could not rename the area."),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/delivery-areas/${id}`),
    onSuccess: invalidate,
    onError: (err: { message?: string }) => setFormError(err?.message ?? "Could not delete the area."),
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.put("/delivery-areas/order", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-areas"] }),
  });

  const list = areas.data?.data ?? [];

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((a) => a.areaId);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  }

  return (
    <div className="panel" style={{ marginBottom: "var(--space-4)" }}>
      <h3>Delivery Regions</h3>
      <p className="field-hint">
        Regions appear in the Region dropdown on the customer form. The order here is the order shown there.
      </p>

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate({ name: name.trim() });
        }}
      >
        <label className="field">
          <span className="visually-hidden">Region name</span>
          <input
            placeholder="New region name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass(name, { required: true })}
          />
        </label>
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add region"}
        </button>
      </form>

      {formError && <InlineError message={formError} />}

      {list.length === 0 && !areas.isLoading && <p className="field-hint">No regions yet — add the first one above.</p>}
      {list.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "3rem" }}>#</th>
                <th>Region</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={a.areaId}>
                  <td>{i + 1}</td>
                  <td>
                    {renaming?.areaId === a.areaId ? (
                      <form
                        className="inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (renameValue.trim()) rename.mutate({ id: a.areaId, name: renameValue.trim() });
                        }}
                      >
                        <input
                          value={renameValue}
                          autoFocus
                          onChange={(e) => setRenameValue(e.target.value)}
                          className={fieldClass(renameValue, { required: true })}
                        />
                        <button type="submit" disabled={rename.isPending}>Save</button>
                        <button type="button" className="secondary" onClick={() => setRenaming(null)}>Cancel</button>
                      </form>
                    ) : (
                      a.name
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="secondary" aria-label={`Move ${a.name} up`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>↑</button>
                      <button className="secondary" aria-label={`Move ${a.name} down`} disabled={i === list.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>↓</button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setRenaming(a);
                          setRenameValue(a.name);
                        }}
                      >
                        Rename
                      </button>
                      <button className="danger" onClick={() => remove.mutate(a.areaId)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
