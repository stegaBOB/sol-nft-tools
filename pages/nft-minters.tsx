import React, { useCallback, useState } from "react";
import { download } from "../util/download";
import jsonFormat from "json-format";
import { useModal } from "../contexts/ModalProvider";
import { useForm } from "react-hook-form";
import { getAddresses, validateSolAddressArray } from "../util/validators";
import { useAlert } from "../contexts/AlertProvider";
import { useConnection } from "@solana/wallet-adapter-react";
import { from, mergeMap, tap, toArray } from "rxjs";
import Head from "next/head";
import { toPublicKey } from "../util/to-publickey";

export default function GetHolders() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [counter, setCounter] = useState(0);
  const [len, setLen] = useState(0);
  const [loading, setLoading] = useState(false);
  const { setAlertState } = useAlert();
  const { setModalState } = useModal();
  const { connection } = useConnection();

  const fetchMinters = useCallback(
    async ({ mints }: { mints: string }) => {
      const parsed = getAddresses(mints);
      setAlertState({
        message: (
          <button className="btn btn-ghost loading">
            Downloading your data.
          </button>
        ),
        open: true,
      });
      setLen(parsed.length);
      setLoading(true);
      let i = 0;
      const owners = [];
      const errors = [];
      const fetchOwner = async (addy: string) => {
        let tx;
        let firstSig;
        let txContent;
        let owner;

        let retries = 0;
        while (retries < 5) {
          try {
            tx = await connection.getConfirmedSignaturesForAddress2(
              toPublicKey(addy)
            );
            firstSig = tx.sort((a, b) => a.blockTime - b.blockTime)[0];
            if (firstSig?.signature) {
              txContent = await connection.getTransaction(firstSig?.signature);

              owner = txContent?.meta?.postTokenBalances[0]?.owner;
              if (owner) {
                owners.push(owner);
              }
            }
          } catch (e) {
            console.error(e?.message || e);
            errors.push({ address: addy, error: e?.message || e });
            retries++;
          }
        }
      };

      from(parsed)
        .pipe(
          mergeMap(
            (addy) =>
              from(fetchOwner(addy)).pipe(
                tap((res) => {
                  i++;
                  setCounter(i);
                })
              ),
            6
          ),
          toArray()
        )
        .subscribe(() => {
          const filename = `Minters-${Date.now()}.json`;
          download(filename, jsonFormat({ owners: [...owners], errors }));
          setModalState({
            message: `Succesfully downloaded ${filename}`,
            open: true,
          });
        });
    },
    [setAlertState, connection, setModalState]
  );

  return (
    <>
      <Head>
        <title>🛠️ Pentacle Tools - 👛 NFT Minters</title>
      </Head>
      <div className="mb-3 w-full max-w-full text-center">
        <h1 className="text-3xl text-white">NFT Minters</h1>
        <hr className="my-4 opacity-10" />
      </div>
      <p className="px-2 text-center">
        This tool gives you a list of first minters for a list of Solana NFTs.
        This helps you e.g. for airdrops to those who initially minted your NFT
        collection.
      </p>
      <hr className="my-4 opacity-10" />
      <div className="max-w-full bg-gray-900 card">
        <form
          onSubmit={handleSubmit(fetchMinters)}
          className={`flex flex-col w-full`}
        >
          <div className="card-body">
            <label className="justify-center mb-4 label">
              Please enter SOL mint IDs as JSON array to get their minters.
            </label>

            <textarea
              {...register("mints", {
                validate: validateSolAddressArray,
                required: "Field is required",
              })}
              rows={4}
              className={`w-full shadow-lg textarea`}
            />
            {!!errors?.mints?.message && (
              <label className="label text-error">
                {errors?.mints?.message}
              </label>
            )}
            <div className="flex flex-col gap-3 justify-center items-center mt-6 text-center">
              {loading && (
                <div className="w-60">
                  <span>{((counter / len) * 100).toFixed(2)}%</span>
                  <progress
                    className="border progress progress-primary border-slate-700"
                    value={(counter / len) * 100}
                    max={100}
                  ></progress>
                </div>
              )}
              <button
                type="submit"
                disabled={!!errors?.mints}
                className={`btn btn-primary rounded-box shadow-lg ${
                  loading ? "loading" : ""}`}
              >
                Get Minters
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
