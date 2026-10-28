"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { done, fail, logActivity, notifyClient, safeFileName, str } from "@/lib/actions";
import { assignSchema, linkDeliverableSchema, milestoneSchema, projectNoteSchema, projectSchema, projectUpdateSchema } from "@/lib/validation";

const LIST = "/admin/projects";
const detail = (id: string) => `${LIST}/${id}`;
const UUID = /^[0-9a-f-]{36}$/i;

// Keep uploads small so they work on typical hosting limits. Use link deliverables for big videos.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "zip", "docx", "xlsx", "pptx", "txt", "mp3"];

export async function createProjectAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const parsed = projectSchema.safeParse({
    client_id: str(fd, "client_id"),
    service_id: str(fd, "service_id"),
    title: str(fd, "title"),
    description: str(fd, "description"),
    status: str(fd, "status") || "planning",
    start_date: str(fd, "start_date"),
    deadline: str(fd, "deadline"),
  });
  if (!parsed.success) fail(LIST, parsed.error.issues[0].message);

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) fail(LIST, "Could not create the project.");
  await logActivity(supabase, user.id, "project.create", "project", data.id, { title: parsed.data.title });
  await notifyClient(supabase, parsed.data.client_id, "New project", `Project "${parsed.data.title}" was created.`, `/portal/projects/${data.id}`);
  revalidatePath(LIST);
  redirect(`${detail(data.id)}?ok=${encodeURIComponent("Project created.")}`);
}

export async function updateProjectAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const id = str(fd, "id");
  if (!UUID.test(id)) fail(LIST, "Invalid request.");
  const parsed = projectUpdateSchema.safeParse({
    id,
    title: str(fd, "title"),
    status: str(fd, "status"),
    progress: str(fd, "progress"),
    deadline: str(fd, "deadline"),
  });
  if (!parsed.success) fail(detail(id), parsed.error.issues[0].message);

  const { data, error } = await supabase
    .from("projects")
    .update({
      title: parsed.data.title,
      status: parsed.data.status,
      progress: parsed.data.progress,
      deadline: parsed.data.deadline,
    })
    .eq("id", id)
    .select("client_id")
    .single();
  if (error || !data) fail(detail(id), "Could not update the project.");
  await logActivity(supabase, user.id, "project.update", "project", id, { status: parsed.data.status, progress: parsed.data.progress });
  await notifyClient(
    supabase,
    data.client_id,
    "Project update",
    `"${parsed.data.title}" is now ${parsed.data.status.replace("_", " ")} (${parsed.data.progress}% complete).`,
    `/portal/projects/${id}`,
  );
  revalidatePath(detail(id));
  done(detail(id), "Project updated.");
}

export async function addMilestoneAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const parsed = milestoneSchema.safeParse({
    project_id: str(fd, "project_id"),
    title: str(fd, "title"),
    due_date: str(fd, "due_date"),
  });
  if (!parsed.success) fail(LIST, parsed.error.issues[0].message);
  const id = parsed.data.project_id;
  const { error } = await supabase.from("milestones").insert(parsed.data);
  if (error) fail(detail(id), "Could not add the milestone.");
  await logActivity(supabase, user.id, "milestone.add", "project", id);
  revalidatePath(detail(id));
  done(detail(id), "Milestone added.");
}

export async function toggleMilestoneAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const id = str(fd, "id");
  const projectId = str(fd, "project_id");
  if (!UUID.test(id) || !UUID.test(projectId)) fail(LIST, "Invalid request.");
  const isDone = str(fd, "done") === "1";
  const { error } = await supabase.from("milestones").update({ is_done: isDone }).eq("id", id).eq("project_id", projectId);
  if (error) fail(detail(projectId), "Could not update the milestone.");
  await logActivity(supabase, user.id, "milestone.toggle", "project", projectId, { done: isDone });
  revalidatePath(detail(projectId));
  done(detail(projectId), "Milestone updated.");
}

export async function addLinkDeliverableAction(fd: FormData) {
  const { supabase, user, profile } = await requireRole(["admin", "staff", "designer"]);
  const parsed = linkDeliverableSchema.safeParse({
    project_id: str(fd, "project_id"),
    title: str(fd, "title"),
    url: str(fd, "url"),
  });
  if (!parsed.success) fail(LIST, parsed.error.issues[0].message);
  const id = parsed.data.project_id;
  const share = profile.role !== "designer" && fd.get("share") === "on";
  const { data: project } = await supabase.from("projects").select("client_id,title").eq("id", id).single();
  const { error } = await supabase
    .from("deliverables")
    .insert({ project_id: id, title: parsed.data.title, kind: "link", url: parsed.data.url, created_by: user.id, visible_to_client: share });
  if (error) fail(detail(id), "Could not add the link.");
  await logActivity(supabase, user.id, "deliverable.link", "project", id);
  if (project && share) await notifyClient(supabase, project.client_id, "New deliverable", `${parsed.data.title} is ready.`, `/portal/projects/${id}`);
  revalidatePath(detail(id));
  done(detail(id), "Link added.");
}

export async function uploadDeliverableAction(fd: FormData) {
  const { supabase, user, profile } = await requireRole(["admin", "staff", "designer"]);
  const id = str(fd, "project_id");
  if (!UUID.test(id)) fail(LIST, "Invalid request.");
  const title = str(fd, "title");
  const share = profile.role !== "designer" && fd.get("share") === "on";
  const file = fd.get("file");
  if (title.length < 2) fail(detail(id), "Enter a title for the file.");
  if (!(file instanceof File) || file.size === 0) fail(detail(id), "Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) fail(detail(id), "File is too large (max 4 MB). Use a link for big files such as videos.");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) fail(detail(id), `File type .${ext} is not allowed.`);

  const path = `${id}/${Date.now()}-${safeFileName(file.name)}`;
  const { error: upErr } = await supabase.storage.from("deliverables").upload(path, file, { contentType: file.type || undefined });
  if (upErr) fail(detail(id), "Upload failed.");

  const { error } = await supabase
    .from("deliverables")
    .insert({ project_id: id, title, kind: "file", storage_path: path, created_by: user.id, visible_to_client: share });
  if (error) {
    await supabase.storage.from("deliverables").remove([path]);
    fail(detail(id), "Could not save the file record.");
  }
  const { data: project } = await supabase.from("projects").select("client_id").eq("id", id).single();
  await logActivity(supabase, user.id, "deliverable.upload", "project", id, { title });
  if (project && share) await notifyClient(supabase, project.client_id, "New deliverable", `${title} is ready to download.`, `/portal/projects/${id}`);
  revalidatePath(detail(id));
  done(detail(id), "File uploaded.");
}

export async function deleteDeliverableAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin"]);
  const id = str(fd, "id");
  const projectId = str(fd, "project_id");
  if (!UUID.test(id) || !UUID.test(projectId)) fail(LIST, "Invalid request.");
  const { data: row } = await supabase.from("deliverables").select("storage_path").eq("id", id).single();
  const { error } = await supabase.from("deliverables").delete().eq("id", id).eq("project_id", projectId);
  if (error) fail(detail(projectId), "Could not delete.");
  if (row?.storage_path) await supabase.storage.from("deliverables").remove([row.storage_path]);
  await logActivity(supabase, user.id, "deliverable.delete", "project", projectId);
  revalidatePath(detail(projectId));
  done(detail(projectId), "Deliverable deleted.");
}

const PROGRESS_STATUSES = ["planning", "in_progress", "review", "completed", "on_hold", "cancelled"];

/**
 * Status and progress change used by designers (and allowed for managers/owner).
 * It goes through one checked database function, which refuses designers who are not assigned
 * to the project and refuses designers who try to complete or cancel it.
 */
export async function setProgressAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff", "designer"]);
  const id = str(fd, "id");
  if (!UUID.test(id)) fail(LIST, "Invalid request.");
  const status = str(fd, "status");
  const progress = Number(str(fd, "progress"));
  if (!PROGRESS_STATUSES.includes(status)) fail(detail(id), "Choose a valid status.");
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) fail(detail(id), "Progress must be a whole number from 0 to 100.");

  const { error } = await supabase.rpc("set_project_progress", { p_project: id, p_progress: progress, p_status: status });
  if (error) fail(detail(id), /not allowed|Only the owner/i.test(error.message) ? error.message : "Could not update the project.");
  await logActivity(supabase, user.id, "project.progress", "project", id, { status, progress });
  revalidatePath(detail(id));
  done(detail(id), "Progress saved.");
}

/** A short progress update. Clients see it in their portal only if it is marked visible (designers' notes stay internal). */
export async function addProjectNoteAction(fd: FormData) {
  const { supabase, user, profile } = await requireRole(["admin", "staff", "designer"]);
  const parsed = projectNoteSchema.safeParse({ project_id: str(fd, "project_id"), body: str(fd, "body") });
  if (!parsed.success) fail(LIST, parsed.error.issues[0].message);
  const id = parsed.data.project_id;
  const visible = profile.role !== "designer" && fd.get("visible") === "on";

  const { error } = await supabase
    .from("project_updates")
    .insert({ project_id: id, body: parsed.data.body, visible_to_client: visible, created_by: user.id });
  if (error) fail(detail(id), "Could not save the update.");
  await logActivity(supabase, user.id, "project.note", "project", id, { visible });
  if (visible) {
    const { data: project } = await supabase.from("projects").select("client_id,title").eq("id", id).single();
    if (project) await notifyClient(supabase, project.client_id, "Project update", `New update on "${project.title}".`, `/portal/projects/${id}`);
  }
  revalidatePath(detail(id));
  done(detail(id), visible ? "Update posted. The client can see it." : "Internal note saved.");
}

export async function assignDesignerAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const parsed = assignSchema.safeParse({ project_id: str(fd, "project_id"), user_id: str(fd, "user_id") });
  if (!parsed.success) fail(LIST, parsed.error.issues[0].message);
  const { project_id, user_id } = parsed.data;
  const { data: person } = await supabase.from("profiles").select("role").eq("id", user_id).maybeSingle();
  if (!person || person.role !== "designer") fail(detail(project_id), "Only designers / editors can be assigned.");
  const { error } = await supabase.from("project_members").insert({ project_id, user_id });
  if (error) fail(detail(project_id), "Could not assign (maybe already assigned).");
  await logActivity(supabase, user.id, "project.assign", "project", project_id, { user_id });
  revalidatePath(detail(project_id));
  done(detail(project_id), "Team member assigned.");
}

export async function unassignDesignerAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const parsed = assignSchema.safeParse({ project_id: str(fd, "project_id"), user_id: str(fd, "user_id") });
  if (!parsed.success) fail(LIST, parsed.error.issues[0].message);
  const { project_id, user_id } = parsed.data;
  const { error } = await supabase.from("project_members").delete().eq("project_id", project_id).eq("user_id", user_id);
  if (error) fail(detail(project_id), "Could not remove the assignment.");
  await logActivity(supabase, user.id, "project.unassign", "project", project_id, { user_id });
  revalidatePath(detail(project_id));
  done(detail(project_id), "Team member removed from the project.");
}

/** Owner / manager decide which deliverables the client may see and download. */
export async function toggleDeliverableVisibleAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const id = str(fd, "id");
  const projectId = str(fd, "project_id");
  if (!UUID.test(id) || !UUID.test(projectId)) fail(LIST, "Invalid request.");
  const visible = str(fd, "visible") === "1";
  const { error } = await supabase.from("deliverables").update({ visible_to_client: visible }).eq("id", id).eq("project_id", projectId);
  if (error) fail(detail(projectId), "Could not change sharing.");
  await logActivity(supabase, user.id, visible ? "deliverable.share" : "deliverable.unshare", "project", projectId);
  if (visible) {
    const { data: project } = await supabase.from("projects").select("client_id,title").eq("id", projectId).single();
    if (project) await notifyClient(supabase, project.client_id, "New deliverable", `A file for "${project.title}" is ready.`, `/portal/projects/${projectId}`);
  }
  revalidatePath(detail(projectId));
  done(detail(projectId), visible ? "Shared with the client." : "No longer shared with the client.");
}
