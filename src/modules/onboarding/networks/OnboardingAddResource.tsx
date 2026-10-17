import Button from "@components/Button";
import { notify } from "@components/Notification";
import { RadioCard, RadioCardGroup } from "@components/RadioCard";
import { useApiCall } from "@utils/api";
import { normalizeHostCIDR } from "@utils/ip";
import { GlobeIcon, NetworkIcon, WorkflowIcon } from "lucide-react";
import * as React from "react";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { useTranslations } from "next-intl";
import { useGroups } from "@/contexts/GroupsProvider";
import { Group } from "@/interfaces/Group";
import { Network, NetworkResource } from "@/interfaces/Network";
import { Policy } from "@/interfaces/Policy";
import { ResourceSingleAddressInput } from "@/modules/networks/resources/ResourceSingleAddressInput";

type Props = {
  onNetworkCreation?: (network: Network) => void;
  onResourceCreation?: (resource: NetworkResource) => void;
  onBack: () => void;
};

export const OnboardingAddResource = ({
  onNetworkCreation,
  onResourceCreation,
  onBack,
}: Props) => {
  const t = useTranslations("onboarding");
  const [resourceType, setResourceType] = useState("");
  const [resourceAddress, setResourceAddress] = useState("");
  const [error, setError] = useState("");
  const [network, setNetwork] = useState<Network>();
  const { mutate } = useSWRConfig();
  const { groups } = useGroups();

  const networkRequest = useApiCall<Network>("/networks", true);
  const resourceRequest = useApiCall<NetworkResource>("/networks", true);
  const policyRequest = useApiCall<Policy>("/policies", true);
  const groupRequest = useApiCall<Group>("/groups", true);

  const allGroupId = groups?.find((g) => g.name === "All")?.id;

  /**
   * Create a new network and add a resource to it
   */
  const createResource = async () => {
    let myNetwork = network;

    if (!network) {
      await networkRequest
        .post({
          name: "My First Network",
          description: t("createdDuringOnboarding"),
        })
        .then((n) => {
          myNetwork = n;
          onNetworkCreation?.(n);
          setNetwork(n);
        });
    }

    if (!myNetwork) return;

    const resourceName =
      resourceType === "subnet" ? "My Subnet" : "My Resource";

    notify({
      title: t("myFirstNetwork"),
      description: t("networkAndResourceCreated"),
      loadingMessage: t("creatingYourResource"),
      promise: resourceRequest
        .post(
          {
            // The resource name is sent to the API as data, so it stays English.
            name: resourceName,
            description: t("createdDuringOnboarding"),
            address: normalizeHostCIDR(resourceAddress),
            enabled: true,
            groups: [],
          },
          `/${myNetwork.id}/resources`,
        )
        .then((r) => {
          onResourceCreation?.(r);
          createOnboardingGroups().then(({ usersGroup, routingPeersGroup }) => {
            createUsersToResourcePolicy(r, usersGroup);
            createUsersToRoutingPeersPolicy(r, usersGroup, routingPeersGroup);
          });
        }),
    });
  };

  /**
   * Create Users and Routing Peers groups if they do not exist
   */
  const createOnboardingGroups = async () => {
    let usersGroup = groups?.find((group) => group.name === "Users");
    let routingPeersGroup = groups?.find(
      (group) => group.name === "Routing Peers",
    );
    if (!usersGroup) {
      usersGroup = await groupRequest.post({
        name: "Users",
      });
    }
    if (!routingPeersGroup) {
      routingPeersGroup = await groupRequest.post({
        name: "Routing Peers",
      });
    }
    return {
      usersGroup,
      routingPeersGroup,
    };
  };

  /**
   * Create a policy that allows users to access the resource
   */
  const createUsersToResourcePolicy = async (
    r: NetworkResource,
    usersGroup: Group,
  ) => {
    const isSubnet = r.type === "subnet";
    // The policy name and description are API data, so they stay English.
    const policyName = `Users to ${r.name}`;
    const policyDescription = `Allows access to this ${
      isSubnet ? `subnet ${r.address}` : `resource ${r.address}`
    }`;

    await policyRequest.post({
      name: policyName,
      description: policyDescription,
      enabled: true,
      rules: [
        {
          name: policyName,
          description: policyDescription,
          enabled: true,
          action: "accept",
          bidirectional: true,
          protocol: "all",
          sources: usersGroup ? [usersGroup.id] : [allGroupId],
          destinationResource: {
            type: r.type,
            id: r.id,
          },
        },
      ],
    });
  };

  /**
   * Create a policy that allows users to access routing peers
   */
  const createUsersToRoutingPeersPolicy = async (
    r: NetworkResource,
    usersGroup: Group,
    routingPeersGroup: Group,
  ) => {
    await policyRequest
      .post({
        name: `Users to Routing Peers`,
        description: `Allows users to access routing peers`,
        enabled: true,
        rules: [
          {
            name: `Users to Routing Peers`,
            description: `Allows users to access routing peers`,
            enabled: true,
            action: "accept",
            bidirectional: true,
            protocol: "all",
            sources: usersGroup ? [usersGroup.id] : [allGroupId],
            destinations: routingPeersGroup
              ? [routingPeersGroup.id]
              : [allGroupId],
          },
        ],
      })
      .then(() => {
        mutate("/policies");
        mutate("/groups");
      });
  };

  const description = useMemo(() => {
    if (resourceType === "ip") return t("resourceIpDescription");
    if (resourceType === "subnet") return t("resourceSubnetDescription");
    if (resourceType === "domain") return t("resourceDomainDescription");
  }, [resourceType, t]);

  const placeholder = useMemo(() => {
    if (resourceType === "ip") return t("resourceIpPlaceholder");
    if (resourceType === "subnet") return t("resourceSubnetPlaceholder");
    if (resourceType === "domain") return t("resourceDomainPlaceholder");
  }, [resourceType, t]);

  return (
    <div className={"relative flex flex-col h-full gap-4"}>
      <div className={"flex flex-col gap-8"}>
        <div>
          <h1 className={"text-xl text-center"}>{t("addResource")}</h1>
          <div
            className={
              "text-sm text-nb-gray-300 font-light mt-2 block text-center sm:px-4"
            }
          >
            {t("resourcesIntro")}
          </div>
        </div>

        <RadioCardGroup value={resourceType} onValueChange={setResourceType}>
          <RadioCard
            value={"ip"}
            title={t("singleIpAddress")}
            icon={<WorkflowIcon size={12} />}
            description={t("singleIpAddressHint")}
          />
          <RadioCard
            value={"subnet"}
            title={t("entireSubnet")}
            icon={<NetworkIcon size={12} />}
            description={t("entireSubnetHint")}
          />
          <RadioCard
            value={"domain"}
            title={t("domain")}
            icon={<GlobeIcon size={12} />}
            description={t("domainTypeHint")}
          />
        </RadioCardGroup>

        {resourceType && (
          <ResourceSingleAddressInput
            label={t("resourceAddressLabel")}
            value={resourceAddress}
            onChange={setResourceAddress}
            onError={setError}
            description={description}
            placeholder={placeholder}
          />
        )}

        <div className={"flex gap-4"}>
          <Button variant={"secondary"} className={"w-full"} onClick={onBack}>
            {t("goBack")}
          </Button>
          <Button
            variant={"primary"}
            className={"w-full"}
            onClick={createResource}
            disabled={resourceAddress === "" || error !== ""}
          >
            {t("createResource")}
          </Button>
        </div>
      </div>
    </div>
  );
};
