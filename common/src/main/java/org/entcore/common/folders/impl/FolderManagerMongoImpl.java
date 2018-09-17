package org.entcore.common.folders.impl;

import static org.entcore.common.folders.impl.QueryHelper.isOk;
import static org.entcore.common.folders.impl.QueryHelper.toErrorStr;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.entcore.common.folders.FolderManager;
import org.entcore.common.share.ShareService;
import org.entcore.common.storage.Storage;
import org.entcore.common.user.UserInfos;
import org.entcore.common.utils.DateUtils;
import org.entcore.common.utils.StringUtils;

import fr.wseduc.mongodb.MongoUpdateBuilder;
import fr.wseduc.swift.storage.DefaultAsyncResult;
import fr.wseduc.webutils.Either;
import fr.wseduc.webutils.http.ETag;
import io.vertx.core.AsyncResult;
import io.vertx.core.CompositeFuture;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.file.FileSystem;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

public class FolderManagerMongoImpl implements FolderManager {
	protected final Storage storage;
	protected final FileSystem fileSystem;
	protected final QueryHelper queryHelper;
	protected final ShareService shareService;

	private static <T> AsyncResult<T> toError(String msg) {
		return new DefaultAsyncResult<>(new Exception(msg));
	}

	private static <T> AsyncResult<T> toError(Throwable msg) {
		return new DefaultAsyncResult<>((msg));
	}

	public FolderManagerMongoImpl(String collection, Storage sto, FileSystem fs, ShareService shareService) {
		this.storage = sto;
		this.fileSystem = fs;
		this.shareService = shareService;
		this.queryHelper = new QueryHelper(collection);
	}

	private Future<JsonObject> mergeShared(String parentFolderId, JsonObject current) {
		return queryHelper.findById(parentFolderId).compose(parentFolder -> {
			Future<JsonObject> future = Future.future();
			if (parentFolder == null) {
				future.fail("Could not found parent folder with id :" + parentFolderId);
			} else {
				try {
					InheritShareComputer.mergeShared(parentFolder, current);
					future.complete(current);
				} catch (Exception e) {
					future.fail(e);
				}
			}
			return future;
		});
	}

	public void share(String id, ShareOperations shareOperations, Handler<AsyncResult<JsonObject>> h) {
		UserInfos user = shareOperations.user;
		this.info(id, user, ev -> {
			if (ev.succeeded()) {
				// compute shared after sharing
				final Handler<Either<String, JsonObject>> handler = new Handler<Either<String, JsonObject>>() {

					@Override
					public void handle(Either<String, JsonObject> event) {
						if (event.isRight()) {
							updateShared(id, user, ev -> {
								if (ev.succeeded()) {
									h.handle(new DefaultAsyncResult<JsonObject>(event.right().getValue()));
								} else {
									h.handle(new DefaultAsyncResult<>(ev.cause()));
								}
							});
						} else {
							h.handle(new DefaultAsyncResult<>(new Exception(event.left().getValue())));
						}
					}
				};
				//
				switch (shareOperations.kind) {
				case GROUP_SHARE:
					this.shareService.groupShare(user.getUserId(), shareOperations.groupId, id, shareOperations.actions,
							handler);
					break;
				case GROUP_SHARE_REMOVE:
					this.shareService.removeGroupShare(shareOperations.groupId, id, shareOperations.actions, handler);
					break;
				case USER_SHARE:
					this.shareService.userShare(user.getUserId(), shareOperations.userId, id, shareOperations.actions,
							handler);
					break;
				case USER_SHARE_REMOVE:
					this.shareService.removeUserShare(shareOperations.userId, id, shareOperations.actions, handler);
					break;
				}
			} else {
				h.handle(ev);
			}
		});
	}

	@Override
	public void createFolder(String destinationFolderId, UserInfos user, JsonObject folder,
			Handler<AsyncResult<JsonObject>> handler) {
		this.mergeShared(destinationFolderId, folder).compose(sharedFolder -> {
			Future<JsonObject> futureCreate = Future.future();
			sharedFolder.put("eParent", destinationFolderId);
			this.createFolder(sharedFolder, user, futureCreate.completer());
			return futureCreate;
		}).setHandler(handler);
	}

	@Override
	public void createFolder(JsonObject folder, UserInfos user, Handler<AsyncResult<JsonObject>> handler) {
		folder.put("eType", FOLDER_TYPE);
		folder.put("created", DateUtils.getDateJsonObject(new Date()));
		folder.put("modified", DateUtils.getDateJsonObject(new Date()));
		folder.put("owner", user.getUserId());
		folder.put("ownerName", user.getUsername());
		queryHelper.insert(folder).setHandler(handler);
	}

	@Override
	public void info(String id, UserInfos user, Handler<AsyncResult<JsonObject>> handler) {
		// find only non deleted file/folder that i can see
		Future<JsonObject> future = queryHelper
				.findOne(queryHelper.queryBuilder().withId(id).filterByInheritShareAndOwner(user).withExcludeDeleted());
		future.setHandler(handler);
	}

	@Override
	public void list(String idFolder, UserInfos user, Handler<AsyncResult<JsonArray>> handler) {
		Future<JsonArray> future = queryHelper.findAll(queryHelper.queryBuilder().filterByInheritShareAndOwner(user)
				.withParent(idFolder).withExcludeDeleted());
		future.setHandler(handler);
	}

	@Override
	public void listFoldersRecursively(UserInfos user, Handler<AsyncResult<JsonArray>> handler) {
		Future<JsonArray> future = queryHelper
				.listRecursive(queryHelper.queryBuilder().filterBySharedAndOwner(user).withExcludeDeleted());
		future.setHandler(handler);
	}

	@Override
	public void listFoldersRecursivelyFromFolder(String idFolder, UserInfos user,
			Handler<AsyncResult<JsonArray>> handler) {
		Future<JsonArray> future = queryHelper.listRecursive(
				queryHelper.queryBuilder().filterBySharedAndOwner(user).withExcludeDeleted().withId(idFolder));
		future.setHandler(handler);
	}

	private boolean inlineDocumentResponse(JsonObject doc, String application) {
		JsonObject metadata = doc.getJsonObject("metadata");
		String storeApplication = doc.getString("application");
		return metadata != null && !"WORKSPACE".equals(storeApplication) && ("image/jpeg"
				.equals(metadata.getString("content-type")) || "image/gif".equals(metadata.getString("content-type"))
				|| "image/png".equals(metadata.getString("content-type"))
				|| "image/tiff".equals(metadata.getString("content-type"))
				|| "image/vnd.microsoft.icon".equals(metadata.getString("content-type"))
				|| "image/svg+xml".equals(metadata.getString("content-type"))
				|| ("application/octet-stream".equals(metadata.getString("content-type")) && application != null));
	}

	private static void notModified(HttpServerRequest request, String fileId) {
		if (fileId != null && !fileId.trim().isEmpty()) {
			request.response().headers().add("ETag", fileId);
		}
		request.response().setStatusCode(304).setStatusMessage("Not Modified").end();
	}

	private void downloadOneFile(JsonObject bodyRoot, HttpServerRequest request) {
		String name = bodyRoot.getString("name");
		String file = bodyRoot.getString("file");
		JsonObject metadata = bodyRoot.getJsonObject("metadata");
		boolean inline = inlineDocumentResponse(bodyRoot, request.params().get("application"));
		if (inline && ETag.check(request, file)) {
			notModified(request, file);
		} else {
			storage.sendFile(file, name, request, inline, metadata);
		}
		return;
	}

	@Override
	public void downloadFiles(Collection<String> ids, UserInfos user, HttpServerRequest request) {
		queryHelper
				.findAll(
						queryHelper.queryBuilder().withIds(ids).filterByInheritShareAndOwner(user).withExcludeDeleted())
				.setHandler(msg -> {
					if (msg.succeeded() && msg.result().size() == ids.size()) {
						// download ONE file
						JsonArray bodyRoots = msg.result();
						if (bodyRoots.size() == 1 //
								&& bodyRoots.getJsonObject(0).getInteger("eType", FOLDER_TYPE) == FILE_TYPE) {
							downloadOneFile(bodyRoots.getJsonObject(0), request);
							return;
						}
						// download multiple files
						@SuppressWarnings("rawtypes")
						List<Future> futures = bodyRoots.stream().map(m -> (JsonObject) m).map(bodyRoot -> {
							switch (bodyRoot.getInteger("eType", -1)) {
							case FOLDER_TYPE:
								String idFolder = bodyRoot.getString("_id");
								Future<JsonArray> future = queryHelper.listRecursive(queryHelper.queryBuilder()
										.filterBySharedAndOwner(user).withExcludeDeleted().withId(idFolder));
								return future;
							case FILE_TYPE:
								JsonArray res = new JsonArray();
								res.add(bodyRoot);
								return Future.succeededFuture(res);
							default:
								Future<JsonArray> f = Future
										.failedFuture("Could not determine the type (file or folder) for id:"
												+ bodyRoot.getString("_id"));
								return f;
							}
						}).collect(Collectors.toList());
						// Zip all files
						CompositeFuture.all(futures).setHandler(result -> {
							if (result.succeeded()) {
								JsonArray rows = result.result().list().stream().map(a -> (JsonArray) a)
										.reduce(new JsonArray(), (a1, a2) -> {
											a1.addAll(a2);
											return a1;
										});
								ZipHelper zipBuilder = new ZipHelper(storage, fileSystem);
								zipBuilder.buildAndSend(rows, request).setHandler(zipEvent -> {
									if (zipEvent.failed()) {
										request.response().setStatusCode(500).end();
									}
								});
							} else {
								request.response().setStatusCode(400).setStatusMessage(result.cause().getMessage())
										.end();
							}
						});

					} else {
						request.response().setStatusCode(404).end();
					}

				});
	}

	@Override
	public void downloadFile(String id, UserInfos user, HttpServerRequest request) {
		this.info(id, user, msg -> {
			if (msg.succeeded()) {
				JsonObject bodyRoot = msg.result();
				switch (bodyRoot.getInteger("eType", -1)) {
				case FOLDER_TYPE:
					String idFolder = bodyRoot.getString("_id");
					Future<JsonArray> future = queryHelper.listRecursive(queryHelper.queryBuilder()
							.filterBySharedAndOwner(user).withExcludeDeleted().withId(idFolder));

					future.setHandler(result -> {
						if (result.succeeded()) {
							JsonArray rows = result.result();
							ZipHelper zipBuilder = new ZipHelper(storage, fileSystem);
							zipBuilder.buildAndSend(bodyRoot, rows, request).setHandler(zipEvent -> {
								if (zipEvent.failed()) {
									request.response().setStatusCode(500).end();
								}
							});
						} else {
							request.response().setStatusCode(404).end();
						}
					});
					return;
				case FILE_TYPE:
					downloadOneFile(bodyRoot, request);
					return;
				default:
					request.response().setStatusCode(400)
							.setStatusMessage("Could not determine the type (file or folder) for id:" + id).end();
					return;
				}
			} else {
				request.response().setStatusCode(404).end();
			}
		});
	}

	private Future<JsonArray> updateInheritedShared(String parentId, JsonObject body) {
		if (parentId != null) {
			return this.mergeShared(parentId, body).compose(current -> {
				return queryHelper.updateInheritShares(current);
			}).map(current -> current.getJsonArray("inheritedShares"));
		} else {
			return Future.succeededFuture();
		}
	}

	@Override
	public void updateShared(String id, UserInfos user, Handler<AsyncResult<Void>> handler) {
		this.info(id, user, msg -> {
			if (msg.succeeded()) {
				JsonObject bodyInfo = msg.result();
				String parent = bodyInfo.getString("eParent");
				switch (bodyInfo.getInteger("eType", -1)) {
				case FOLDER_TYPE:
					this.updateInheritedShared(parent, bodyInfo).compose(res -> {
						String idFolder = bodyInfo.getString("_id");
						return queryHelper.listRecursive(
								queryHelper.queryBuilder().filterBySharedAndOwner(user).withId(idFolder));
					}).compose(rows -> {
						try {
							InheritShareComputer computer = new InheritShareComputer(bodyInfo, rows);
							computer.compute();
							JsonArray operations = computer.buildMongoBulk();
							return queryHelper.bulkUpdate(operations);
						} catch (Exception e) {
							return Future.failedFuture(e);
						}
					}).setHandler(handler);
					return;
				case FILE_TYPE:
					this.updateInheritedShared(parent, bodyInfo).setHandler(res -> handler
							.handle(res.succeeded() ? new DefaultAsyncResult<>(null) : toError(res.cause())));
					return;
				default:
					handler.handle(toError("Could not determine the type (file or folder) for id:" + id));
					return;
				}
			} else {
				handler.handle(toError(msg.cause()));
			}
		});

	}

	@Override
	public void rename(String id, String newName, UserInfos user, Handler<AsyncResult<Void>> handler) {
		this.info(id, user, msg -> {
			if (msg.succeeded()) {
				MongoUpdateBuilder set = new MongoUpdateBuilder().addToSet("name", newName);
				queryHelper.update(id, set).setHandler(handler);
			} else {
				handler.handle(toError(msg.cause()));
			}
		});
	}

	@Override
	public void move(String sourceId, String destinationFolderId, UserInfos user,
			Handler<AsyncResult<JsonObject>> handler) {
		this.info(sourceId, user, msg -> {
			if (msg.succeeded()) {
				JsonObject bodyFind = msg.result();
				JsonObject previous = bodyFind.getJsonObject("result");
				if (previous != null) {
					this.updateShared(sourceId, user, updateEvent -> {
						MongoUpdateBuilder set = new MongoUpdateBuilder().addToSet("eParent", destinationFolderId);
						queryHelper.update(sourceId, set).map(v -> previous).setHandler(handler);
					});
				} else {
					handler.handle(toError("Could not found source with id :" + sourceId));
				}
			} else {
				handler.handle(toError(msg.cause()));
			}
		});

	}

	private Future<JsonArray> copyFolderRecursively(String oldParentId, Optional<String> newParentId) {
		// list all tree including folders excluding deleted files
		return queryHelper.findAll(queryHelper.queryBuilder().withParent(oldParentId).withExcludeDeleted())
				.compose(children -> {
					return this.copyFile(children.stream().map(u -> (JsonObject) u).collect(Collectors.toSet()),
							newParentId);
				}).compose(copies -> {
					// for each folder copy recursively
					Set<JsonObject> folders = copies.stream().map(v -> (JsonObject) v)
							.filter(o -> o.getInteger("eType", -1) == FOLDER_TYPE).collect(Collectors.toSet());
					@SuppressWarnings("rawtypes")
					List<Future> futures = folders.stream().map(folder -> {
						return copyFolderRecursively(folder.getString("copyFromId"),
								Optional.ofNullable(folder.getString("_id")));
					}).collect(Collectors.toList());
					// merge children result and current result
					return CompositeFuture.all(futures).map(res -> {
						JsonArray result = new JsonArray();
						result.addAll(copies);
						res.list().stream().map(a -> (JsonArray) a).forEach(a -> result.addAll(a));
						return result;
					});
				});
	}

	private Future<JsonArray> copyFile(Collection<JsonObject> originals, Optional<String> parent) {
		return StorageHelper.copyFileInStorage(storage, originals).compose(oldFileIdForNewFileId -> {
			// set newFileIds and parent
			JsonArray copies = originals.stream().map(o -> {
				JsonObject copy = o.copy();
				copy.put("copyFromId", copy.getString("_id"));
				copy.remove("_id");
				if (parent.isPresent()) {
					copy.put("eParent", parent.get());
				} else {
					copy.remove("eParent");
				}
				StorageHelper.replaceAll(copy, oldFileIdForNewFileId);
				return copy;
			}).collect(JsonArray::new, JsonArray::add, JsonArray::addAll);
			// save copies in database using bulk (new fileid)
			return queryHelper.insertAll(copies).map(copies);
		});
	}

	@Override
	public void copy(String sourceId, Optional<String> destFolderId, UserInfos user,
			Handler<AsyncResult<JsonArray>> handler) {
		this.info(sourceId, user, message -> {
			if (message.succeeded()) {
				// check whether id is empty
				final Optional<String> safeDestFolderId = destFolderId.isPresent()
						&& StringUtils.isEmpty(destFolderId.get()) ? Optional.empty() : destFolderId;

				JsonObject original = message.result();
				String id = original.getString("_id");
				switch (original.getInteger("eType", -1)) {
				case FOLDER_TYPE:
					copyFolderRecursively(id, safeDestFolderId).setHandler(handler);
					return;
				case FILE_TYPE:
					copyFile(Arrays.asList(original), safeDestFolderId).setHandler(handler);
					return;
				default:
					handler.handle(toError("Could not determine the type (file or folder) for id:" + id));
					return;
				}
			} else {
				handler.handle(message.mapEmpty());
			}
		});
	}

	private Future<JsonArray> deleteFiles(List<JsonObject> files) {
		// Set to avoid duplicate
		Set<String> ids = files.stream().map(o -> o.getString("_id")).collect(Collectors.toSet());
		return queryHelper.deleteFiles((ids)).compose(res -> {
			Future<JsonArray> future = Future.future();
			List<String> listOfFilesIds = StorageHelper.getListOfFileIds(files);
			this.storage.removeFiles(new JsonArray(listOfFilesIds), resDelete -> {
				if (isOk(resDelete)) {
					future.complete(new JsonArray(new ArrayList<>(ids)));
				} else {
					future.fail(toErrorStr(resDelete));
				}
			});
			return future;
		});
	}

	private Future<JsonArray> deleteFolders(List<JsonObject> files) {
		// Set to avoid duplicate
		Set<String> ids = files.stream().map(o -> o.getString("_id")).collect(Collectors.toSet());
		return queryHelper.deleteFiles((ids)).map(res -> {
			return new JsonArray(new ArrayList<>(ids));
		});
	}

	private Future<JsonArray> deleteFolderRecursively(JsonObject folder, UserInfos user) {
		String idFolder = folder.getString("_id");
		return queryHelper.listRecursive(queryHelper.queryBuilder().filterBySharedAndOwner(user).withId(idFolder))
				.compose(rows -> {
					if (rows.isEmpty()) {
						return Future.succeededFuture();
					}
					List<JsonObject> files = rows.stream().map(o -> (JsonObject) o)
							.filter(o -> o.getInteger("eType", -1) == FILE_TYPE).collect(Collectors.toList());
					List<JsonObject> folders = rows.stream().map(o -> (JsonObject) o)
							.filter(o -> o.getInteger("eType", -1) != FILE_TYPE).collect(Collectors.toList());

					return CompositeFuture.all(deleteFolders(folders), deleteFiles(files));
				}).map(result -> {
					if (result.result().size() == 0) {
						return new JsonArray();
					}
					JsonArray array = result.result().resultAt(0);
					array.addAll(result.result().resultAt(1));
					return array;
				});
	}

	@Override
	public void delete(String id, UserInfos user, Handler<AsyncResult<JsonArray>> handler) {
		this.info(id, user, msg -> {
			if (msg.succeeded()) {
				JsonObject body = msg.result();
				switch (body.getInteger("eType", -1)) {
				case FOLDER_TYPE:
					deleteFolderRecursively(body, user).setHandler(handler);
					return;
				case FILE_TYPE:
					deleteFiles(Arrays.asList(body)).setHandler(handler);
					return;
				default:
					handler.handle(toError("Could not determine the type (file or folder) for id:" + id));
					return;
				}
			} else {
				handler.handle(toError(msg.cause()));
			}
		});
	}

	private Future<JsonArray> setDeleteFlag(List<JsonObject> files, boolean deleted) {
		// Set to avoid duplicate
		Set<String> ids = files.stream().map(o -> o.getString("_id")).collect(Collectors.toSet());
		return queryHelper.updateAll(ids, new MongoUpdateBuilder().push("deleted", deleted))
				.map(new JsonArray(new ArrayList<>(ids)));
	}

	private Future<JsonArray> setDeleteFlagRecursively(JsonObject folder, UserInfos user, boolean deleted) {
		String idFolder = folder.getString("_id");
		return queryHelper.listRecursive(queryHelper.queryBuilder().filterBySharedAndOwner(user).withId(idFolder))
				.compose(rows -> {
					if (rows.isEmpty()) {
						return Future.succeededFuture();
					}
					List<JsonObject> all = rows.stream().map(o -> (JsonObject) o).collect(Collectors.toList());
					return setDeleteFlag(all, deleted);
				});
	}

	private void setDeleteFlag(String id, UserInfos user, Handler<AsyncResult<JsonArray>> handler, boolean deleted) {
		this.info(id, user, msg -> {
			if (msg.succeeded()) {
				JsonObject body = msg.result();
				switch (body.getInteger("eType", -1)) {
				case FOLDER_TYPE:
					setDeleteFlagRecursively(body, user, deleted).setHandler(handler);
					return;
				case FILE_TYPE:
					setDeleteFlag(Arrays.asList(body), deleted).setHandler(handler);
					return;
				default:
					handler.handle(toError("Could not determine the type (file or folder) for id:" + id));
					return;
				}
			} else {
				handler.handle(toError(msg.cause()));
			}
		});
	}

	@Override
	public void restore(String id, UserInfos user, Handler<AsyncResult<JsonArray>> handler) {
		setDeleteFlag(id, user, handler, false);
	}

	@Override
	public void trash(String id, UserInfos user, Handler<AsyncResult<JsonArray>> handler) {
		setDeleteFlag(id, user, handler, true);
	}
}
