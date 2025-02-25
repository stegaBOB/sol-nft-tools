import React, { useCallback, useMemo, useState } from "react";
import { AttributesForm } from "../components/attributes-form";
import jsonFormat from "json-format";
import { Controller, useForm } from "react-hook-form";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import FileTile from "../components/file-tile";
import { URL_MATCHER } from "../util/validators";
import { useAlert } from "../contexts/AlertProvider";
import { getRange } from "../util/get-range";
import { fileToBuffer } from "../util/file-to-buffer";
import { ShdwDrive } from "@shadow-drive/sdk";
import { toPublicKey } from "../util/to-publickey";
import createFileList from "../util/create-file-list";
import { useModal } from "../contexts/ModalProvider";
import { Creator } from "../util/metadata-schema";
import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js-next";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { shortenAddress } from "../util/shorten-address";
import { sleep } from "../util/sleep";
import { useBalance } from "../contexts/BalanceProvider";

export default function GibAirdrop() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm();
  const { setModalState } = useModal();
  const { setAlertState } = useAlert();
  const [loading, setLoading] = useState(false);
  const wallet = useWallet();
  const [numberOfFiles, setNumberOfFiles] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [mint, setMint] = useState("");
  const { connection } = useConnection();
  const handleRemoveFile = useCallback(
    (name: string) => {
      setFiles(files.filter((f) => f.name !== name));
    },
    [files]
  );

  const fileTiles = useMemo(
    () =>
      getRange(numberOfFiles).map((i) => (
        <FileTile
          key={i}
          file={files[i]}
          remove={handleRemoveFile}
          setFiles={setFiles}
          files={files}
        />
      )),
    [numberOfFiles, files]
  );

  const FilesForm = useMemo(
    () => (
      <>
        <label className="label" htmlFor="files">
          <span className="label-text">Files (up to 4)*</span>
        </label>
        <div className="btn-group">
          {numberOfFiles < 4 && (
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.preventDefault();
                setNumberOfFiles(numberOfFiles + 1);
              }}
            >
              Add file
            </button>
          )}
          {numberOfFiles > 1 && (
            <button
              className="btn btn-error"
              onClick={(e) => {
                e.preventDefault();
                setNumberOfFiles(numberOfFiles - 1);
                setFiles(files.slice(0, numberOfFiles - 1));
              }}
            >
              Remove file
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 my-4 upload-field">
          {fileTiles}
        </div>

        {!!files?.length && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label" htmlFor="imageUrlFileName">
                Image URL
              </label>
              <select
                {...register("imageUrlFileName")}
                className="w-full select"
              >
                <option selected disabled value=""></option>
                {files.map((f, i) => (
                  <option key={i} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="animationUrlFileName">
                Animation URL
              </label>
              <select
                {...register("animationUrlFileName")}
                className="w-full select"
              >
                <option selected disabled value=""></option>
                {files.map((f, i) => (
                  <option key={i} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <br />
      </>
    ),
    [files, numberOfFiles, setNumberOfFiles, handleRemoveFile, register]
  );

  const upload = useCallback(
    async (formData) => {
      setLoading(true);
      setAlertState!({
        message: (
          <button className="loading btn btn-ghost">Starting Upload</button>
        ),
        open: true,
      });

      const metaplex = new Metaplex(connection).use(
        walletAdapterIdentity(wallet.wallet.adapter)
      );

      const shdwDrive = await new ShdwDrive(connection, wallet).init();

      const creators = [
        new Creator({
          address: wallet?.publicKey,
          share: 100,
          verified: true,
        }),
      ];

      const cat = formData?.properties?.category || "image";

      const meta = Object.assign({
        name: formData.name,
        symbol: formData.symbol || null,
        description: formData.description || null,
        seller_fee_basis_points: +formData.seller_fee_basis_points || 0,
        image: formData.image || null,
        animation_url: formData.animation_url || null,
        attributes: formData.attributes || [],
        external_url: formData.external_url || null,
        properties: {
          category: cat,
          creators,
        },
      });

      try {
        const bytes = await files.reduce(async (acc, curr) => {
          return (await acc) + (await fileToBuffer(curr)).buffer.byteLength;
        }, Promise.resolve(0));

        const shdwNeeded = ((bytes * 1.2) / LAMPORTS_PER_SOL).toFixed(6);

        alert(`You will need circa ${shdwNeeded} SHDW`);
        const { shdw_bucket } = await shdwDrive.createStorageAccount(
          `NFT-${Date.now()}`,
          `${Math.round((bytes * 1.2) / 1000)}kb`
        );

        const animFile = files.find(
          (_m) => _m.type.startsWith("video") || _m.type.startsWith("glb")
        );
        const imgFile = files.find((_m) => _m.type.startsWith("image"));

        meta.animation_url = formData.animationUrlFileName
          ? `https://shdw-drive.genesysgo.net/${shdw_bucket}/${formData.animationUrlFileName}`
          : !!animFile?.name
          ? `https://shdw-drive.genesysgo.net/${shdw_bucket}/${animFile.name}`
          : null;
        meta.image = formData.imageUrlFileName
          ? `https://shdw-drive.genesysgo.net/${shdw_bucket}/${formData.imageUrlFileName}`
          : !!imgFile?.name
          ? `https://shdw-drive.genesysgo.net/${shdw_bucket}/${imgFile.name}`
          : null;

        meta.properties.files = files.map((f) => {
          return {
            type: f.type || "glb",
            uri: `https://shdw-drive.genesysgo.net/${shdw_bucket}/${f.name}`,
          };
        });

        setAlertState({
          message: (
            <button className="loading btn btn-ghost">
              Uploading {files.length + 1 /** manifest */} files
            </button>
          ),
          open: true,
        });

        const manifest = new File([jsonFormat(meta)], "manifest.json", {
          type: "application/json",
        });

        setAlertState({
          message: (
            <div className="flex flex-row">
              <button className="loading btn btn-ghost" />
              Signing and Minting NFT, check wallet for signature request. There
              will be several.
            </div>
          ),
          open: true,
        });
        await shdwDrive.uploadMultipleFiles(
          toPublicKey(shdw_bucket),
          createFileList([...files, manifest])
        );

        const { transactionId } = await metaplex.nfts().create({
          symbol: meta.symbol || "",
          name: meta.name || "",
          uri: `https://shdw-drive.genesysgo.net/${shdw_bucket}/manifest.json`,
          sellerFeeBasisPoints: !Number.isNaN(+meta.seller_fee_basis_points)
            ? +meta.seller_fee_basis_points
            : 0,
          creators,
          isMutable: true,
        });

        let confirmed = false;
        while (!confirmed) {
          setAlertState({
            message: (
              <div className="flex flex-row items-center">
                <button className="loading btn btn-ghost"></button> Confirming
                transaction{" "}
                <a
                  href={`https://explorer.solana.com/tx/${transactionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate"
                >
                  {shortenAddress(transactionId, 3)}
                </a>
              </div>
            ),
            open: true,
          });
          const tx = await connection.getTransaction(transactionId, {
            commitment: "confirmed",
          });

          if (tx && tx?.meta?.postTokenBalances[0]?.mint) {
            setMint(tx?.meta?.postTokenBalances[0]?.mint);
            setAlertState({
              severity: "success",
              duration: 5000,
              message: "Success!",
              open: true,
            });
            confirmed = true;
          } else {
            await sleep(300);
          }
        }
      } catch (e) {
        console.error(e);
        setLoading(false);
        setAlertState({
          open: false,
        });
        setModalState({
          message: "An error occured! For info check console!",
          open: true,
        });
      }
    },
    [wallet, files, connection, setAlertState]
  );

  const { solBalance, shdwBalance } = useBalance();

  return wallet?.publicKey ? (
    <div>
      <br />

      <h2 className="text-3xl text-center">
        NFT Minting - powered by SHDW Drive - BETA
      </h2>

      <div>
        {!!shdwBalance && (
          <div className="mt-3 w-full text-center">
            <span className="badge badge-success">{shdwBalance} SHDW</span>
            <span className="ml-3 badge badge-primary">
              {solBalance}BalashdwBalance SOL
            </span>
          </div>
        )}
      </div>

      <hr className="my-3 opacity-10" />

      <div className="bg-gray-900 card">
        <div className="card-body">
          {!wallet && <WalletMultiButton />}
          {wallet && (
            <form
              className={`flex flex-col w-full`}
              onSubmit={handleSubmit((e) => upload(e))}
            >
              <h2 className="text-3xl font-bold text-center">Metadata</h2>
              <div className="text-center">
                The metadata standard is defined{" "}
                <a
                  href="https://docs.phantom.app/integrating/tokens/non-fungible-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "underline" }}
                >
                  here by Phantom
                </a>
              </div>
              <br />
              <div
                className="pb-6 form-control"
                style={{ position: "relative" }}
              >
                <label className="label">
                  <span className="label-text">Name *</span>
                </label>
                <input
                  type="text"
                  placeholder="Name"
                  className={`input input-bordered ${
                    !!errors.name ? "input-error" : ""
                  }`}
                  {...register("name", { required: true, maxLength: 32 })}
                />
                {errors.name && (
                  <label
                    className="py-0 label"
                    style={{ position: "absolute", bottom: 0 }}
                  >
                    <span className="text-red-400 label-text-alt">
                      {errors.name.type === "maxLength" && "Max 32 characters!"}
                      {errors.name.type === "required" && "Field is required!"}
                    </span>
                  </label>
                )}
              </div>
              <div
                className="pb-6 form-control"
                style={{ position: "relative" }}
              >
                <label className="label" htmlFor="symbol">
                  <span className="label-text">Symbol</span>
                </label>
                <input
                  type="text"
                  placeholder="Symbol"
                  className={`input input-bordered ${
                    !!errors.symbol ? "input-error" : ""
                  }`}
                  {...register("symbol", { maxLength: 10 })}
                />
                {errors.symbol && (
                  <label
                    className="py-0 label"
                    style={{ position: "absolute", bottom: 0 }}
                  >
                    <span className="text-red-400 label-text-alt">
                      Max 10 characters!
                    </span>
                  </label>
                )}
              </div>
              <div
                className="pb-6 form-control"
                style={{ position: "relative" }}
              >
                <label className="label" htmlFor="description">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="h-24 textarea"
                  placeholder="Description"
                  {...register("description")}
                ></textarea>
              </div>{" "}
              <div
                className="pb-6 form-control"
                style={{ position: "relative" }}
              >
                <label className="label">
                  <span className="label-text">
                    External URL (Link to your website, e.g.
                    https://rugbirdz.com)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="External URL"
                  {...register("external_url", { pattern: URL_MATCHER })}
                  className={`input input-bordered ${
                    !!errors.external_url ? "input-error" : ""
                  }`}
                />

                {errors.external_url && (
                  <label
                    className="py-0 label"
                    style={{ position: "absolute", bottom: 0 }}
                  >
                    <span className="text-red-400 label-text-alt">
                      Not a valid url, don&apos;t forget protocol (https://)
                    </span>
                  </label>
                )}
              </div>
              <div
                className="pb-6 form-control"
                style={{ position: "relative" }}
              >
                <label htmlFor="category" className="label">
                  <span className="label-text">Category</span>
                </label>
                <Controller
                  name="properties.category"
                  control={control}
                  render={({ field: { onChange, onBlur, value, ref } }) => (
                    <select
                      onBlur={onBlur}
                      onChange={onChange}
                      className="select"
                      value={value}
                      ref={ref}
                      name="category"
                    >
                      <option value="image">Image</option>
                      <option value="vr">VR</option>
                      <option value="video">Video</option>
                      <option value="html">HTML</option>
                    </select>
                  )}
                />
              </div>
              <div
                className="pb-6 form-control"
                style={{ position: "relative" }}
              >
                <label className="label" htmlFor="seller_fee_basis_points">
                  <span className="label-text">
                    Resale Fee (0-10 000, e.g. for 5% use 500)
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  placeholder="e.g. 500"
                  {...register("seller_fee_basis_points", {
                    min: 0,
                    max: 10_000,
                  })}
                  className={`input input-bordered ${
                    !!errors.seller_fee_basis_points ? "input-error" : ""
                  }`}
                />

                {errors.seller_fee_basis_points && (
                  <label
                    className="py-0 label"
                    style={{ position: "absolute", bottom: 0 }}
                  >
                    <span className="text-red-400 label-text-alt">
                      Must be between 0 and 10 000
                    </span>
                  </label>
                )}
              </div>
              <AttributesForm register={register} />
              {FilesForm}
              {wallet && (
                <button
                  className={`btn ${loading ? "loading" : ""}`}
                  disabled={loading}
                  type="submit"
                >
                  Next
                </button>
              )}
            </form>
          )}
        </div>
      </div>

      <input
        type="checkbox"
        id="my-modal-2"
        checked={!!mint}
        className="modal-toggle"
      />

      <div id="my-modal" className="modal">
        <div className="modal-box">
          <p>
            NFT has been minted.{" "}
            <a
              className="link"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://solscan.io/token/${mint}`}
            >
              View on SolScan
            </a>
          </p>
          <div className="modal-action">
            <a onClick={() => setMint(undefined)} className="btn">
              Close
            </a>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <>
      <div className="mx-auto max-w-xs bg-gray-700 card">
        <div className="card-body">
          <h2 className="text-center">To begin please</h2>
          <br />
          <WalletMultiButton />
        </div>
      </div>
    </>
  );
}
